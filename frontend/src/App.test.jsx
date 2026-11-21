
import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  vi
} from "vitest";

import {
  render,
  screen,
  fireEvent,
  act
} from "@testing-library/react";

import App from "./App.jsx";
import EntryList from "./components/EntryList.jsx";
import StudentSearch from "./components/StudentSearch.jsx";

// Fix JSDOM window.scrollTo warning
Object.defineProperty(window, "scrollTo", {
  value: vi.fn(),
  writable: true,
  configurable: true
});

beforeEach(() => {
  localStorage.clear();

  // Reset scroll mock
  window.scrollTo.mockClear();

  // Mock API responses
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ status: "ok" })
    })
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("PracTrack interface", () => {

  it("F-T1 displays the PracTrack system name", async () => {
    await act(async () => {
      render(<App />);
    });

    expect(
      await screen.findByText("PracTrack")
    ).toBeInTheDocument();
  });

  it("F-T2 filters students when the search field is typed into", () => {
    render(
      <StudentSearch
        students={[
          {
            name: "Alex Santos",
            studentNo: "2023-00001"
          },
          {
            name: "Jamie Cruz",
            studentNo: "2023-00002"
          }
        ]}
      />
    );

    fireEvent.change(
      screen.getByLabelText("Search students"),
      {
        target: {
          value: "Alex"
        }
      }
    );

    expect(
      screen.queryByText(
        "Jamie Cruz (2023-00002)"
      )
    ).not.toBeInTheDocument();
  });

  it("F-T3 displays guidance when there are no practicum entries", () => {
    render(
      <EntryList entries={[]} />
    );

    expect(
      screen.getByText(
        /No practicum entries yet/
      )
    ).toBeInTheDocument();
  });

});
