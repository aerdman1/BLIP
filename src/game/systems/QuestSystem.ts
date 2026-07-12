/**
 * Data-driven quest walker for "THE FIRST CONTACT".
 * A module singleton so quest state survives Field ⇄ Blipstream scene switches.
 * Every advance autosaves and re-emits the HUD objective.
 */
import { EVT } from '../config';
import { THE_FIRST_CONTACT, findQuest, type QuestDef, type QuestStep } from '../data/quests';
import { bus } from './EventBus';
import { getSave, updateSave } from './SaveSystem';
import { audio } from './AudioSystem';

class QuestSystem {
  quest: QuestDef = THE_FIRST_CONTACT;
  private stepIndex = 0;
  /** slice-scope counters */
  dronesDestroyed = 0;

  /** point the walker at a specific quest (call before init on scene entry) */
  load(questId: string): void {
    this.quest = findQuest(questId);
  }

  /** restore from save (or start fresh). Adopts the save's current quest. */
  init(): void {
    const save = getSave();
    this.quest = findQuest(save.currentQuest);
    const idx = this.quest.steps.findIndex((s) => s.id === save.questStep);
    this.stepIndex = idx >= 0 ? idx : 0;
    this.dronesDestroyed = save.flags.dronesCleared ? 2 : 0;
    this.emitObjective();
  }

  get step(): QuestStep {
    return this.quest.steps[this.stepIndex];
  }

  get stepId(): string {
    return this.step.id;
  }

  isAtOrPast(stepId: string): boolean {
    const idx = this.quest.steps.findIndex((s) => s.id === stepId);
    return idx >= 0 && this.stepIndex >= idx;
  }

  isComplete(): boolean {
    return this.stepId === 'complete';
  }

  /** Complete the CURRENT step if it matches, advancing to the next. */
  complete(stepId: string): boolean {
    if (this.stepId !== stepId || this.stepIndex >= this.quest.steps.length - 1) return false;
    const finished = this.step;
    this.stepIndex++;
    updateSave((s) => {
      if (!s.completedQuestSteps.includes(finished.id)) s.completedQuestSteps.push(finished.id);
      s.questStep = this.stepId;
    });
    audio.questAdvance();
    bus.emit(EVT.questStep, { completed: finished.id, current: this.stepId });
    this.emitObjective();
    return true;
  }

  /** Debug/tests: jump directly to a step (no autosave of skipped steps). */
  jumpTo(stepId: string): boolean {
    const idx = this.quest.steps.findIndex((s) => s.id === stepId);
    if (idx < 0) return false;
    this.stepIndex = idx;
    updateSave((s) => {
      s.questStep = stepId;
      s.completedQuestSteps = this.quest.steps.slice(0, idx).map((st) => st.id);
    });
    bus.emit(EVT.questStep, { completed: null, current: this.stepId });
    this.emitObjective();
    return true;
  }

  restart(): void {
    this.stepIndex = 0;
    this.dronesDestroyed = 0;
    updateSave((s) => {
      s.questStep = this.stepId;
      s.completedQuestSteps = [];
    });
    this.emitObjective();
  }

  emitObjective(): void {
    bus.emit(EVT.questObjective, {
      quest: this.quest.name,
      stepId: this.stepId,
      objective: this.step.objective,
      hint: this.step.hint ?? '',
      index: this.stepIndex,
      total: this.quest.steps.length,
    });
  }
}

export const quests = new QuestSystem();
