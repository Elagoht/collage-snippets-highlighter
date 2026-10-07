// One run of some work at a time; a run asked for while one is under way runs
// once more after it, since what asked — a save — may have come after the work
// started. Kept free of the vscode API so it can be tested in Node.
export class Rerun {
  private running: Promise<void> | undefined;
  private again = false;

  /** Whether a run is under way or asked for. */
  get pending(): boolean {
    return this.running !== undefined;
  }

  /** run runs work now, or once more after the run under way; onStart and onDone
   * are called around the whole, however many times work runs in it. */
  run(work: () => Promise<void>, onStart: () => void = () => {}, onDone: () => void = () => {}): Promise<void> {
    if (this.running) {
      this.again = true;
      return this.running;
    }
    this.running = (async () => {
      onStart();
      do {
        this.again = false;
        await work();
      } while (this.again);
    })().finally(() => {
      this.running = undefined;
      onDone();
    });
    return this.running;
  }
}
