import { render } from "@testing-library/react"
import { describe, it, expect } from "vitest"
import { Target } from "lucide-react"
import { Icon } from "./icon"
import { iconMap } from "@/lib/copy/icon-map"

describe("Icon", () => {
  it("renders an svg with stroke-width 2 and aria-hidden", () => {
    const { container } = render(<Icon icon={Target} />)
    const svg = container.querySelector("svg")
    expect(svg).not.toBeNull()
    expect(svg).toHaveAttribute("stroke-width", "2")
    expect(svg).toHaveAttribute("aria-hidden", "true")
  })

  it("defaults to size 20 (width and height) and forwards a custom size", () => {
    const { container: def } = render(<Icon icon={Target} />)
    const defaultSvg = def.querySelector("svg")
    expect(defaultSvg).toHaveAttribute("width", "20")
    expect(defaultSvg).toHaveAttribute("height", "20")

    const { container: sized } = render(<Icon icon={Target} size={28} />)
    const sizedSvg = sized.querySelector("svg")
    expect(sizedSvg).toHaveAttribute("width", "28")
    expect(sizedSvg).toHaveAttribute("height", "28")
  })

  it("forwards className to the underlying svg", () => {
    const { container } = render(<Icon icon={Target} className="text-primary" />)
    const svg = container.querySelector("svg")
    expect(svg?.getAttribute("class")).toContain("text-primary")
  })
})

describe("iconMap", () => {
  it("maps every locked concept to a Lucide component", () => {
    const concepts = [
      "target",
      "availability",
      "verified",
      "team",
      "partners",
      "proposal",
      "payments",
      "search",
      "energy",
      "megaphone",
      "trophy",
      "saved",
    ] as const
    for (const concept of concepts) {
      // Lucide icons are memo/forwardRef objects; assert each concept resolves
      // to a renderable component value rather than a bare function.
      expect(iconMap[concept]).toBeDefined()
      const { container } = render(<Icon icon={iconMap[concept]} />)
      expect(container.querySelector("svg")).not.toBeNull()
    }
  })

  it("renders through Icon for a mapped concept", () => {
    const { container } = render(<Icon icon={iconMap.verified} />)
    expect(container.querySelector("svg")).not.toBeNull()
  })
})
