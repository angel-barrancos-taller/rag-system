import { render, screen } from "@testing-library/react";

describe("jest jsdom project", () => {
  it("renders with React Testing Library and jest-dom matchers", () => {
    render(<p>smoke</p>);
    expect(screen.getByText("smoke")).toBeInTheDocument();
  });
});
