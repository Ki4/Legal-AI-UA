// jsdom 30 parses `<dialog>` and implements none of it: `showModal`, `close`
// and the `open` property are simply absent, so a component that calls them
// throws in the test run and works in every browser. This file is the smallest
// stand-in that lets `Dialog`'s own logic be tested.
//
// **Be clear about what this buys and what it does not.** It restores the API
// surface the component talks to — open, close, and the `close` event that Esc
// and a `method="dialog"` submit fire. It restores none of the behaviour the
// component chose a native dialog *for*: no top layer, no focus trap, no inert
// background, no backdrop. Those are exactly the properties worth having, and
// no test in this workspace asserts them — they are the browser's promise, not
// ours. A test here that seemed to prove focus was trapped would be proving
// something about this file.
//
// Applied to the whole `dom` project rather than to one package, because the
// console screens that open a dialog need it for the same reason.
if (typeof HTMLDialogElement !== "undefined" && !HTMLDialogElement.prototype.showModal) {
  Object.defineProperty(HTMLDialogElement.prototype, "open", {
    configurable: true,
    get(this: HTMLDialogElement) {
      return this.hasAttribute("open");
    },
    set(this: HTMLDialogElement, value: boolean) {
      if (value) this.setAttribute("open", "");
      else this.removeAttribute("open");
    },
  });

  const open = function (this: HTMLDialogElement) {
    if (this.hasAttribute("open")) throw new Error("dialog is already open");
    this.setAttribute("open", "");
  };

  HTMLDialogElement.prototype.show = open;
  HTMLDialogElement.prototype.showModal = open;

  HTMLDialogElement.prototype.close = function (this: HTMLDialogElement, returnValue?: string) {
    if (!this.hasAttribute("open")) return;
    this.removeAttribute("open");
    if (returnValue !== undefined) this.returnValue = returnValue;
    // Real dialogs fire this asynchronously; firing it synchronously here would
    // let a test observe an ordering the browser never produces.
    queueMicrotask(() => this.dispatchEvent(new Event("close")));
  };
}
