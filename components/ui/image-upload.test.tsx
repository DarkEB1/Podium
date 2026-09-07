import * as React from "react"
import { render, screen, waitFor, fireEvent } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, it, expect, vi, beforeEach } from "vitest"

import { ImageUpload } from "./image-upload"

// ---------------------------------------------------------------------------
// Mock the storage upload pipeline. The component accepts an injectable
// `uploadFile` so tests never hit Supabase; the default impl (used in the app)
// mints a presigned URL via lib/storage createUploadUrl (B8) and PUTs bytes.
// ---------------------------------------------------------------------------

function makeFile(
  name: string,
  type: string,
  sizeBytes: number
): File {
  const file = new File(["x"], name, { type })
  // jsdom File ignores content length; force the reported size.
  Object.defineProperty(file, "size", { value: sizeBytes })
  return file
}

// Stub HTMLImageElement so the dimension probe resolves deterministically.
function stubImageDimensions(width: number, height: number) {
  const proto = globalThis.Image.prototype as unknown as {
    _w?: number
    _h?: number
  }
  Object.defineProperty(globalThis.Image.prototype, "naturalWidth", {
    configurable: true,
    get() {
      return width
    },
  })
  Object.defineProperty(globalThis.Image.prototype, "naturalHeight", {
    configurable: true,
    get() {
      return height
    },
  })
  // Fire onload as soon as src is assigned.
  Object.defineProperty(globalThis.Image.prototype, "src", {
    configurable: true,
    set() {
      // microtask so the onload handler is attached first
      Promise.resolve().then(() => {
        this.onload?.(new Event("load"))
      })
    },
  })
  void proto
}

beforeEach(() => {
  globalThis.URL.createObjectURL = vi.fn(() => "blob:preview")
  globalThis.URL.revokeObjectURL = vi.fn()
  stubImageDimensions(800, 800)
})

describe("ImageUpload", () => {
  it("renders the label, subtext and a file input accepting image types", () => {
    render(
      <ImageUpload
        value={null}
        onUploaded={() => {}}
        aspect={1}
        label="Profile photo"
        subtext="Square, at least 500px"
      />
    )
    expect(screen.getByText("Profile photo")).toBeInTheDocument()
    expect(screen.getByText("Square, at least 500px")).toBeInTheDocument()
    const input = screen.getByTestId("image-upload-input") as HTMLInputElement
    expect(input.accept).toMatch(/image\/jpeg/)
    expect(input.accept).toMatch(/image\/png/)
    expect(input.accept).toMatch(/heic/)
  })

  // A single input with capture="environment" forced iOS straight to the
  // camera, making it impossible to pick from the photo library. The Upload
  // button must drive a capture-less input; the camera button its own input.
  it("the library input has no capture attribute so the photo roll opens", () => {
    render(<ImageUpload value={null} onUploaded={() => {}} aspect={1} />)
    const input = screen.getByTestId("image-upload-input") as HTMLInputElement
    expect(input.hasAttribute("capture")).toBe(false)
  })

  it("the camera button drives a separate input that requests camera capture", () => {
    render(<ImageUpload value={null} onUploaded={() => {}} aspect={1} shape="circle" />)
    const camera = screen.getByTestId("image-upload-camera-input") as HTMLInputElement
    expect(camera.hasAttribute("capture")).toBe(true)
    expect(camera.accept).toMatch(/image\/jpeg/)
  })

  it("shows a circular thumbnail preview when an existing value is set and shape is circle", () => {
    render(
      <ImageUpload
        value="https://cdn.example/a.jpg"
        onUploaded={() => {}}
        aspect={1}
        shape="circle"
      />
    )
    const preview = screen.getByAltText(/current image/i)
    expect(preview).toHaveAttribute("src", "https://cdn.example/a.jpg")
    expect(preview.className).toMatch(/rounded-full/)
  })

  it("rejects a file larger than maxMB with a field-specific error", async () => {
    const user = userEvent.setup()
    const onUploaded = vi.fn()
    render(
      <ImageUpload value={null} onUploaded={onUploaded} aspect={1} maxMB={10} />
    )
    const big = makeFile("big.png", "image/png", 11 * 1024 * 1024)
    await user.upload(screen.getByTestId("image-upload-input"), big)
    expect(await screen.findByRole("alert")).toHaveTextContent(/10\s?MB/i)
    expect(onUploaded).not.toHaveBeenCalled()
  })

  it("rejects an unsupported file type", async () => {
    render(<ImageUpload value={null} onUploaded={() => {}} aspect={1} />)
    const gif = makeFile("a.gif", "image/gif", 1024)
    // The input's `accept` attr makes user-event drop the gif before change;
    // fire change directly to exercise the component's own type guard.
    const input = screen.getByTestId("image-upload-input") as HTMLInputElement
    fireEvent.change(input, { target: { files: [gif] } })
    expect(await screen.findByRole("alert")).toHaveTextContent(/JPEG|PNG|HEIC/i)
  })

  it("rejects an image smaller than minPx", async () => {
    stubImageDimensions(300, 300)
    const user = userEvent.setup()
    render(
      <ImageUpload value={null} onUploaded={() => {}} aspect={1} minPx={500} />
    )
    const small = makeFile("small.jpg", "image/jpeg", 1024)
    await user.upload(screen.getByTestId("image-upload-input"), small)
    expect(await screen.findByRole("alert")).toHaveTextContent(/500\s?px/i)
  })

  it("opens an inline cropper with zoom and reposition controls for a valid file", async () => {
    const user = userEvent.setup()
    render(<ImageUpload value={null} onUploaded={() => {}} aspect={1} />)
    const file = makeFile("good.jpg", "image/jpeg", 1024)
    await user.upload(screen.getByTestId("image-upload-input"), file)
    expect(await screen.findByRole("dialog")).toBeInTheDocument()
    expect(screen.getByLabelText(/zoom/i)).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: /save|apply|confirm/i })
    ).toBeInTheDocument()
  })

  it("uploads the cropped result and calls onUploaded with the public URL", async () => {
    const user = userEvent.setup()
    const onUploaded = vi.fn()
    const uploadFile = vi
      .fn()
      .mockResolvedValue("https://cdn.example/uploaded.jpg")
    render(
      <ImageUpload
        value={null}
        onUploaded={onUploaded}
        aspect={1}
        uploadFile={uploadFile}
      />
    )
    const file = makeFile("good.jpg", "image/jpeg", 1024)
    await user.upload(screen.getByTestId("image-upload-input"), file)
    await screen.findByRole("dialog")
    await user.click(screen.getByRole("button", { name: /save|apply|confirm/i }))
    await waitFor(() => {
      expect(uploadFile).toHaveBeenCalled()
      expect(onUploaded).toHaveBeenCalledWith("https://cdn.example/uploaded.jpg")
    })
  })

  // WS-PROFILE-01 / PM-10: replacing a photo must hand the previous URL to the
  // upload pipeline so the old object can be removed instead of orphaned.
  it("passes the existing value to the upload pipeline when replacing", async () => {
    const user = userEvent.setup()
    const onUploaded = vi.fn()
    const uploadFile = vi
      .fn()
      .mockResolvedValue("https://cdn.example/new.jpg")
    render(
      <ImageUpload
        value="https://cdn.example/old.jpg"
        onUploaded={onUploaded}
        aspect={1}
        uploadFile={uploadFile}
      />
    )
    const file = makeFile("good.jpg", "image/jpeg", 1024)
    await user.upload(screen.getByTestId("image-upload-input"), file)
    await screen.findByRole("dialog")
    await user.click(screen.getByRole("button", { name: /save|apply|confirm/i }))
    await waitFor(() => {
      // third argument is the previous URL to clean up
      expect(uploadFile).toHaveBeenCalledWith(
        expect.anything(),
        expect.any(String),
        "https://cdn.example/old.jpg"
      )
    })
  })

  it("supports mandatory validation: marks the control invalid when required and empty", () => {
    render(
      <ImageUpload
        value={null}
        onUploaded={() => {}}
        aspect={1}
        required
        showError
      />
    )
    const region = screen.getByRole("group")
    expect(region).toHaveAttribute("aria-invalid", "true")
    expect(screen.getByRole("alert")).toHaveTextContent(/required/i)
  })

  it("is not invalid when required and a value is present", () => {
    render(
      <ImageUpload
        value="https://cdn.example/a.jpg"
        onUploaded={() => {}}
        aspect={1}
        required
        showError
      />
    )
    expect(screen.getByRole("group")).toHaveAttribute("aria-invalid", "false")
  })
})
