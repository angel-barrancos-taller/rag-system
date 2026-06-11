import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { NeuButton, NeuCard, NeuInput, NeuTextarea } from "./neu";

describe("NeuCard", () => {
  it("renders children inside a raised card", () => {
    render(<NeuCard>card content</NeuCard>);
    const card = screen.getByText("card content");
    expect(card).toBeInTheDocument();
    expect(card.className).toContain("shadow-neu");
    expect(card.className).toContain("bg-neu-base");
  });

  it("merges a custom className", () => {
    render(<NeuCard className="custom-class">x</NeuCard>);
    expect(screen.getByText("x").className).toContain("custom-class");
  });
});

describe("NeuButton", () => {
  it("fires onClick", async () => {
    const onClick = jest.fn();
    render(<NeuButton onClick={onClick}>Click me</NeuButton>);
    await userEvent.click(screen.getByRole("button", { name: "Click me" }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("is disabled and visually muted when disabled", () => {
    render(<NeuButton disabled>Nope</NeuButton>);
    const button = screen.getByRole("button", { name: "Nope" });
    expect(button).toBeDisabled();
    expect(button.className).toContain("disabled:opacity-60");
  });
});

describe("NeuInput / NeuTextarea", () => {
  it("accepts typed text", async () => {
    render(<NeuInput aria-label="name" />);
    const input = screen.getByLabelText("name");
    await userEvent.type(input, "hello");
    expect(input).toHaveValue("hello");
  });

  it("renders an inset textarea", () => {
    render(<NeuTextarea aria-label="question" />);
    expect(screen.getByLabelText("question").className).toContain("shadow-neu-inset");
  });
});
