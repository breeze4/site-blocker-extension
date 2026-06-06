describe("content script blocking", () => {
  beforeEach(() => {
    jest.resetModules();
    document.body.innerHTML = "<main>Allowed</main>";
    window.history.replaceState({}, "", "/current-page");
  });

  test("blocks the current domain when stored time left is non-finite", async () => {
    global.StorageUtils.getFromStorage = jest.fn((key) => {
      if (key === "domainTimers") {
        return Promise.resolve({
          localhost: {
            timeLeft: Infinity,
          },
        });
      }
      return Promise.resolve(null);
    });

    require("../src/content.js");
    await Promise.resolve();
    await Promise.resolve();

    expect(document.body.textContent).toContain("Access Blocked");
    expect(document.body.textContent).toContain("Your time is up for this site.");
  });
});
