import { translateSystemEventToUIState } from "./translateSystemEventToUIState";
import type { RealtimeEvent, TurnUIState, UserFacingUIState } from "./types";

export class UIStateController {
  private stateByTurn = new Map<string, TurnUIState>();

  public update(event: RealtimeEvent): TurnUIState | null {
    const translated: UserFacingUIState = translateSystemEventToUIState(event);
    const previous = this.stateByTurn.get(event.turnId);

    if (
      previous &&
      previous.state === translated.state &&
      previous.label === translated.label
    ) {
      return null;
    }

    const next: TurnUIState = {
      turnId: event.turnId,
      state: translated.state,
      label: translated.label,
      updatedAt: event.timestamp ?? Date.now(),
    };

    this.stateByTurn.set(event.turnId, next);
    return next;
  }

  public get(turnId: string): TurnUIState | undefined {
    return this.stateByTurn.get(turnId);
  }

  public getAll(): Record<string, TurnUIState> {
    return Object.fromEntries(this.stateByTurn.entries());
  }

  public clear(turnId: string): void {
    this.stateByTurn.delete(turnId);
  }

  public reset(): void {
    this.stateByTurn.clear();
  }
}
