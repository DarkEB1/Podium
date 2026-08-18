"use client"

import * as React from "react"
import { Camera, ImagePlus, Loader2 } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { createClient } from "@/lib/supabase/client"
import {
  createUploadUrl,
  type StorageBucket,
} from "@/lib/storage"

/**
 * ImageUpload — file picker / camera capture with an inline zoom + reposition
 * cropper (spec §3A.2, §4A.1). Accepts JPEG / PNG / HEIC, enforces a minimum
 * pixel dimension and maximum file size, then uploads the cropped result via a
 * presigned URL minted by lib/storage `createUploadUrl` (B8) — bytes go
 * straight from the browser to Supabase Storage, never through Next.js.
 *
 * The public API is frozen per shared contract §1.2. `uploadFile` is an
 * injection seam used by tests to mock the storage pipeline; the app uses the
 * default presigned-URL implementation.
 */

/** Accepted image MIME types and their canonical extensions. */
const ACCEPTED: { mime: string; ext: string; label: string }[] = [
  { mime: "image/jpeg", ext: "jpg", label: "JPEG" },
  { mime: "image/png", ext: "png", label: "PNG" },
  { mime: "image/heic", ext: "heic", label: "HEIC" },
  { mime: "image/heif", ext: "heic", label: "HEIC" },
]

const ACCEPT_ATTR = [
  ...ACCEPTED.map((a) => a.mime),
  ".jpg",
  ".jpeg",
  ".png",
  ".heic",
  ".heif",
].join(",")

export type UploadFile = (file: Blob, ext: string) => Promise<string>

export interface ImageUploadProps {
  value: string | null
  onUploaded: (url: string) => void
  /** 1 = square / avatar; pass 16/9 etc. for covers. */
  aspect: number
  shape?: "circle" | "square"
  minPx?: number
  maxMB?: number
  label?: string
  subtext?: string
  /** Mandatory-validation support: mark the control invalid when empty. */
  required?: boolean
  /** When true, render the validation error for the current state. */
  showError?: boolean
  className?: string
  /** Test/override seam for the upload pipeline. */
  uploadFile?: UploadFile
}

/** Choose the storage bucket from the requested shape / aspect. */
function bucketFor(aspect: number, shape?: "circle" | "square"): StorageBucket {
  if (shape === "circle") return "avatars"
  if (aspect === 1) return "logos"
  return "covers"
}

/** Default upload implementation: presigned URL + direct PUT. */
function makeDefaultUpload(
  bucket: StorageBucket
): UploadFile {
  return async (file, ext) => {
    const supabase = createClient()
    // We need the signed-in user id to namespace the object under RLS.
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) throw new Error("You must be signed in to upload an image.")

    const { uploadUrl, publicUrl } = await createUploadUrl(supabase, {
      bucket,
      userId: user.id,
      ext,
    })
    const res = await fetch(uploadUrl, {
      method: "PUT",
      body: file,
      headers: { "content-type": file.type || "application/octet-stream" },
    })
    if (!res.ok) throw new Error("Upload failed. Please try again.")

    // `publicUrl` is null for private buckets. bucketFor() only ever returns
    // avatars/logos/covers, which are public — but assert rather than cast, so
    // that routing a private bucket through here fails loudly instead of
    // silently storing an empty image src.
    if (!publicUrl) {
      throw new Error(
        `The ${bucket} bucket is private; an image surface needs a public bucket or a signed download URL.`
      )
    }
    return publicUrl
  }
}

/** Read an image File's natural pixel dimensions. */
function readDimensions(
  url: string
): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () =>
      resolve({ width: img.naturalWidth, height: img.naturalHeight })
    img.onerror = () => reject(new Error("Could not read image."))
    img.src = url
  })
}

interface PendingCrop {
  file: File
  previewUrl: string
  ext: string
  /** Natural pixel dimensions, read once at selection time. */
  naturalWidth: number
  naturalHeight: number
}

/** Longest edge of the exported crop — plenty for a hero cover, small upload. */
const MAX_EXPORT_PX = 1600

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

/** Load an image element from an object URL for canvas rasterisation. */
function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error("Could not decode image."))
    img.src = url
  })
}

/**
 * Rasterise the crop-window contents (cover-fitted image + zoom + offsets) to
 * a canvas and return the encoded blob. Returns null whenever the runtime
 * cannot do it (no 2d context, un-decodable format such as HEIC outside
 * Safari, toBlob unavailable) so the caller can fall back to the original.
 */
async function rasteriseCrop(
  pending: PendingCrop,
  zoom: number,
  offset: { x: number; y: number },
  cropW: number,
  cropH: number,
): Promise<{ blob: Blob; ext: string } | null> {
  try {
    if (typeof document === "undefined") return null
    // Displayed pixels per natural pixel: cover fit at zoom 1, scaled up.
    const scale =
      Math.max(cropW / pending.naturalWidth, cropH / pending.naturalHeight) *
      zoom
    // Source rect (natural pixels) visible through the crop window. The image
    // centre sits at the window centre displaced by the offset.
    const sw = cropW / scale
    const sh = cropH / scale
    const sx = clamp(
      pending.naturalWidth / 2 - (cropW / 2 + offset.x) / scale,
      0,
      Math.max(0, pending.naturalWidth - sw)
    )
    const sy = clamp(
      pending.naturalHeight / 2 - (cropH / 2 + offset.y) / scale,
      0,
      Math.max(0, pending.naturalHeight - sh)
    )

    // Export at the crop's native resolution, capped so a 6000px photo does
    // not upload megabytes it will never render at.
    const outW = Math.round(Math.min(MAX_EXPORT_PX, Math.max(cropW, sw)))
    const outH = Math.max(1, Math.round(outW * (cropH / cropW)))

    const canvas = document.createElement("canvas")
    if (typeof canvas.toBlob !== "function") return null
    canvas.width = outW
    canvas.height = outH
    const ctx = canvas.getContext("2d")
    if (!ctx) return null

    const img = await loadImage(pending.previewUrl)
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, outW, outH)

    // PNG stays PNG (transparency); everything else exports as JPEG.
    const png = pending.ext === "png"
    const blob = await new Promise<Blob | null>((resolve) =>
      png
        ? canvas.toBlob(resolve, "image/png")
        : canvas.toBlob(resolve, "image/jpeg", 0.9)
    )
    if (!blob) return null
    return { blob, ext: png ? "png" : "jpg" }
  } catch {
    return null
  }
}

export function ImageUpload({
  value,
  onUploaded,
  aspect,
  shape = "square",
  minPx = 500,
  maxMB = 10,
  label,
  subtext,
  required = false,
  showError = false,
  className,
  uploadFile,
}: ImageUploadProps) {
  const inputId = React.useId()
  const errorId = React.useId()
  const fileRef = React.useRef<HTMLInputElement>(null)
  const cameraRef = React.useRef<HTMLInputElement>(null)

  const [error, setError] = React.useState<string | null>(null)
  const [pending, setPending] = React.useState<PendingCrop | null>(null)
  const [zoom, setZoom] = React.useState(1)
  const [offset, setOffset] = React.useState({ x: 0, y: 0 })
  const [uploading, setUploading] = React.useState(false)

  const doUpload = React.useMemo(
    () => uploadFile ?? makeDefaultUpload(bucketFor(aspect, shape)),
    [uploadFile, aspect, shape]
  )

  const requiredError = required && !value ? "This image is required." : null
  const visibleError = error ?? (showError ? requiredError : null)

  async function handleFiles(files: FileList | null) {
    setError(null)
    const file = files?.[0]
    if (!file) return

    const match = ACCEPTED.find((a) => a.mime === file.type)
    if (!match) {
      setError("Please choose a JPEG, PNG or HEIC image.")
      return
    }
    if (file.size > maxMB * 1024 * 1024) {
      setError(`Image must be ${maxMB}MB or smaller.`)
      return
    }

    const previewUrl = URL.createObjectURL(file)
    let width: number
    let height: number
    try {
      ;({ width, height } = await readDimensions(previewUrl))
      if (width < minPx || height < minPx) {
        URL.revokeObjectURL(previewUrl)
        setError(`Image must be at least ${minPx}px on its shortest side.`)
        return
      }
    } catch {
      URL.revokeObjectURL(previewUrl)
      setError("That file could not be read as an image.")
      return
    }

    setZoom(1)
    setOffset({ x: 0, y: 0 })
    setPending({
      file,
      previewUrl,
      ext: match.ext,
      naturalWidth: width,
      naturalHeight: height,
    })
  }

  function closeCropper() {
    if (pending) URL.revokeObjectURL(pending.previewUrl)
    setPending(null)
    setUploading(false)
    if (fileRef.current) fileRef.current.value = ""
    if (cameraRef.current) cameraRef.current.value = ""
  }

  async function handleSave() {
    if (!pending) return
    setUploading(true)
    setError(null)
    try {
      // Rasterise the visible crop (cover fit + zoom + reposition) so the
      // uploaded bytes match what the user framed. When the runtime cannot
      // rasterise (no canvas 2d context, un-decodable format) the original
      // blob is the fallback so the contract (a public URL) always holds.
      const cropped = await rasteriseCrop(pending, zoom, offset, cropW, cropH)
      const url = cropped
        ? await doUpload(cropped.blob, cropped.ext)
        : await doUpload(pending.file, pending.ext)
      onUploaded(url)
      closeCropper()
    } catch (e) {
      setUploading(false)
      setError(e instanceof Error ? e.message : "Upload failed.")
    }
  }

  const round = shape === "circle"

  // Crop window geometry. Cover fit: at zoom 1 the image exactly fills the
  // window on its tighter axis, so nothing renders at natural pixel size and
  // a huge photo no longer appears wildly over-zoomed.
  const cropW = 240
  const cropH = aspect >= 1 ? 240 / aspect : 240
  const coverScale = pending
    ? Math.max(cropW / pending.naturalWidth, cropH / pending.naturalHeight)
    : 1
  const baseW = pending ? pending.naturalWidth * coverScale : 0
  const baseH = pending ? pending.naturalHeight * coverScale : 0
  // The image centre can move at most this far before an edge enters the
  // window; sliders and stored offsets are clamped to it.
  const maxOffsetX = Math.max(0, Math.round((baseW * zoom - cropW) / 2))
  const maxOffsetY = Math.max(0, Math.round((baseH * zoom - cropH) / 2))

  function handleZoomChange(nextZoom: number) {
    setZoom(nextZoom)
    const nextMaxX = Math.max(0, Math.round((baseW * nextZoom - cropW) / 2))
    const nextMaxY = Math.max(0, Math.round((baseH * nextZoom - cropH) / 2))
    setOffset((o) => ({
      x: clamp(o.x, -nextMaxX, nextMaxX),
      y: clamp(o.y, -nextMaxY, nextMaxY),
    }))
  }

  return (
    // aria-invalid is valid on a labelled group per ARIA 1.2; the lint rule is
    // conservative. We surface validity so forms can flag a mandatory field.
    // eslint-disable-next-line jsx-a11y/role-supports-aria-props
    <div
      role="group"
      aria-label={label ?? "Image upload"}
      aria-invalid={visibleError ? "true" : "false"}
      aria-describedby={visibleError ? errorId : undefined}
      className={cn("flex flex-col gap-2", className)}
    >
      {label ? (
        <label
          htmlFor={inputId}
          className="text-medium font-medium text-foreground"
        >
          {label}
        </label>
      ) : null}

      <div className="flex items-center gap-4">
        <div
          className={cn(
            "flex size-20 shrink-0 items-center justify-center overflow-hidden border border-foreground/10 bg-muted",
            round ? "rounded-full" : "rounded-xl"
          )}
        >
          {value ? (
            // eslint-disable-next-line @next/next/no-img-element -- arbitrary external/CDN or blob URL, not a static asset
            <img
              src={value}
              alt="Current image"
              className={cn(
                "size-full object-cover",
                round ? "rounded-full" : "rounded-xl"
              )}
            />
          ) : (
            <ImagePlus
              aria-hidden="true"
              className="size-6 text-muted-foreground"
            />
          )}
        </div>

        <div className="flex flex-col gap-1">
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => fileRef.current?.click()}
            >
              {value ? "Replace" : "Upload"}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => cameraRef.current?.click()}
            >
              <Camera aria-hidden="true" className="size-4" />
              <span className="sr-only">Use camera</span>
            </Button>
          </div>
          {subtext ? (
            <p className="text-small text-muted-foreground">{subtext}</p>
          ) : null}
        </div>
      </div>

      {/* Library picker. A `capture` attribute here would force mobile
          browsers straight to the camera and make the photo roll unreachable,
          so this input must never carry one — the camera path has its own
          input below. */}
      <input
        ref={fileRef}
        id={inputId}
        data-testid="image-upload-input"
        type="file"
        accept={ACCEPT_ATTR}
        className="sr-only"
        onChange={(e) => void handleFiles(e.target.files)}
      />
      <input
        ref={cameraRef}
        data-testid="image-upload-camera-input"
        type="file"
        accept={ACCEPT_ATTR}
        capture={round ? "user" : "environment"}
        aria-hidden="true"
        tabIndex={-1}
        className="sr-only"
        onChange={(e) => void handleFiles(e.target.files)}
      />

      {visibleError ? (
        <p id={errorId} role="alert" className="text-small text-destructive">
          {visibleError}
        </p>
      ) : null}

      {pending ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Crop image"
        >
          <div className="flex w-full max-w-sm flex-col gap-4 rounded-xl bg-card p-4 shadow-card-hover">
            <h2 className="text-large font-heading text-foreground">
              Adjust your image
            </h2>

            <div
              className={cn(
                "relative mx-auto overflow-hidden bg-muted",
                round ? "rounded-full" : "rounded-xl"
              )}
              style={{ width: cropW, height: cropH }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={pending.previewUrl}
                alt="Image to crop"
                draggable={false}
                className="absolute left-1/2 top-1/2 max-w-none select-none"
                style={{
                  width: baseW,
                  height: baseH,
                  transform: `translate(calc(-50% + ${offset.x}px), calc(-50% + ${offset.y}px)) scale(${zoom})`,
                }}
              />
            </div>

            <label className="flex flex-col gap-1 text-small text-foreground">
              <span>Zoom</span>
              <input
                type="range"
                aria-label="Zoom"
                min={1}
                max={3}
                step={0.05}
                value={zoom}
                onChange={(e) => handleZoomChange(Number(e.target.value))}
                className="w-full accent-primary"
              />
            </label>

            <div className="grid grid-cols-2 gap-2 text-small text-foreground">
              <label className="flex flex-col gap-1">
                <span>Move horizontally</span>
                <input
                  type="range"
                  aria-label="Reposition horizontally"
                  min={-maxOffsetX}
                  max={maxOffsetX}
                  step={1}
                  value={offset.x}
                  onChange={(e) =>
                    setOffset((o) => ({
                      ...o,
                      x: clamp(Number(e.target.value), -maxOffsetX, maxOffsetX),
                    }))
                  }
                  className="w-full accent-primary"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span>Move vertically</span>
                <input
                  type="range"
                  aria-label="Reposition vertically"
                  min={-maxOffsetY}
                  max={maxOffsetY}
                  step={1}
                  value={offset.y}
                  onChange={(e) =>
                    setOffset((o) => ({
                      ...o,
                      y: clamp(Number(e.target.value), -maxOffsetY, maxOffsetY),
                    }))
                  }
                  className="w-full accent-primary"
                />
              </label>
            </div>

            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={closeCropper}
                disabled={uploading}
              >
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={() => void handleSave()}
                disabled={uploading}
              >
                {uploading ? (
                  <Loader2
                    aria-hidden="true"
                    className="size-4 animate-spin"
                  />
                ) : null}
                Save
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
