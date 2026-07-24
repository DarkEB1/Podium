import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import { describe, it, expect } from "vitest"
import { useForm } from "react-hook-form"

import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "./form"
import { Input } from "./input"

/** A-7 — form errors must be announced, not just coloured red. */
function Harness() {
  const form = useForm<{ email: string }>({ defaultValues: { email: "" } })

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(() => {})}>
        <FormField
          control={form.control}
          name="email"
          rules={{ required: "Email is required" }}
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email</FormLabel>
              <FormControl>
                <Input {...field} />
              </FormControl>
              <FormDescription>We only use this to reach you.</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <button type="submit">Submit</button>
      </form>
    </Form>
  )
}

describe("Form accessibility (A-7)", () => {
  it("does not mark a pristine field invalid and does not dangle an IDREF", () => {
    render(<Harness />)
    const input = screen.getByLabelText("Email")
    expect(input).not.toHaveAttribute("aria-invalid")

    const described = (input.getAttribute("aria-describedby") ?? "").split(" ").filter(Boolean)
    expect(described.length).toBeGreaterThan(0)
    for (const id of described) {
      expect(document.getElementById(id), `dangling aria-describedby id: ${id}`).not.toBeNull()
    }
  })

  it("marks the field invalid and points aria-describedby at the error node when it errors", async () => {
    render(<Harness />)
    fireEvent.click(screen.getByRole("button", { name: "Submit" }))

    const alert = await screen.findByRole("alert")
    expect(alert).toHaveTextContent("Email is required")

    const input = screen.getByLabelText("Email")
    await waitFor(() => expect(input).toHaveAttribute("aria-invalid", "true"))

    const described = (input.getAttribute("aria-describedby") ?? "").split(" ").filter(Boolean)
    expect(described).toContain(alert.id)
    for (const id of described) {
      expect(document.getElementById(id), `dangling aria-describedby id: ${id}`).not.toBeNull()
    }
  })

  it("renders the error as an assertive live region", async () => {
    render(<Harness />)
    fireEvent.click(screen.getByRole("button", { name: "Submit" }))
    const alert = await screen.findByRole("alert")
    expect(alert).toHaveAttribute("aria-live", "assertive")
  })
})
