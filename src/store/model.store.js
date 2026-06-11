import { EventEmitter } from 'node:events';

/**
 * Status lifecycle for the single tracked Drive model:
 *
 *   idle ───▶ syncing ───▶ translating ───▶ ready
 *                │              │
 *                └─────▶ failed ◀────────────┘
 *
 * Once `ready`, the model can re-enter `syncing` when the upstream Drive file
 * changes (different `sourceModifiedTime`).
 *
 * @typedef {'idle'|'syncing'|'translating'|'ready'|'failed'} ModelStatus
 * @typedef {'list'|'download'|'upload'|'translate'} SyncStep
 *
 * @typedef {Object} ModelSnapshot
 * @property {ModelStatus} status
 * @property {SyncStep|null} step
 * @property {string|null} urn                   - URL-safe base64 URN of the OSS object.
 * @property {string|null} objectName            - Object key inside the bucket.
 * @property {string|null} sourceFileId          - Drive file id.
 * @property {string|null} sourceFileName
 * @property {string|null} sourceModifiedTime    - ISO timestamp from Drive.
 * @property {number|null} sourceSize
 * @property {string|null} progress              - Translation progress (e.g. "42%").
 * @property {string|null} error
 * @property {number} updatedAt
 */

const initial = () => ({
  status: 'idle',
  step: null,
  urn: null,
  objectName: null,
  sourceFileId: null,
  sourceFileName: null,
  sourceModifiedTime: null,
  sourceSize: null,
  progress: null,
  error: null,
  updatedAt: Date.now(),
});

class ModelStore extends EventEmitter {
  #state = initial();

  snapshot() {
    return { ...this.#state };
  }

  isUpToDate(file) {
    if (!file) return false;
    const { status, sourceFileId, sourceModifiedTime } = this.#state;
    return (
      status === 'ready' &&
      sourceFileId === file.id &&
      sourceModifiedTime === file.modifiedTime
    );
  }

  beginSync(file) {
    this.#patch({
      status: 'syncing',
      step: 'list',
      sourceFileId: file?.id ?? null,
      sourceFileName: file?.name ?? null,
      sourceModifiedTime: file?.modifiedTime ?? null,
      sourceSize: file?.size ? Number(file.size) : null,
      progress: null,
      error: null,
    });
  }

  setStep(step) {
    this.#patch({ status: 'syncing', step });
  }

  setTranslating(urn, objectName, progress = null) {
    this.#patch({
      status: 'translating',
      step: null,
      urn,
      objectName,
      progress,
    });
  }

  setProgress(progress) {
    if (this.#state.status !== 'translating') return;
    this.#patch({ progress });
  }

  setReady(urn, objectName) {
    this.#patch({
      status: 'ready',
      step: null,
      urn: urn ?? this.#state.urn,
      objectName: objectName ?? this.#state.objectName,
      progress: '100%',
      error: null,
    });
  }

  fail(error) {
    this.#patch({
      status: 'failed',
      error: error?.message ?? String(error),
    });
  }

  reset() {
    this.#state = initial();
    this.emit('change', this.snapshot());
  }

  #patch(patch) {
    this.#state = { ...this.#state, ...patch, updatedAt: Date.now() };
    this.emit('change', this.snapshot());
  }
}

export const modelStore = new ModelStore();
