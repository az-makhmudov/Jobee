import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { Button, ModalSurface, Textarea } from './Primitives.js';

interface PromptLabels {
  title: string;
  label: string;
  submit: string;
}
interface Feedback {
  confirm: (message: string) => Promise<boolean>;
  prompt: (message: string, initial?: string, labels?: PromptLabels) => Promise<string | null>;
  alert: (message: string) => void;
}
const FeedbackContext = createContext<Feedback>({
  confirm: async (message) => window.confirm(message),
  prompt: async (message, initial) => window.prompt(message, initial),
  alert: (message) => window.alert(message),
});
interface Request {
  kind: 'confirm' | 'prompt' | 'alert';
  message: string;
  initial?: string;
  labels?: PromptLabels;
  resolve: (value: string | boolean | null) => void;
}
export function FeedbackProvider({ children }: { children: ReactNode }) {
  const [queue, setQueue] = useState<Request[]>([]),
    [value, setValue] = useState('');
  const requests = useRef<Request[]>([]);
  const enqueue = (request: Request) => {
    requests.current = [...requests.current, request];
    setQueue(requests.current);
  };
  const active = queue[0];
  useEffect(() => {
    setValue(active?.initial || '');
  }, [active]);
  useEffect(
    () => () => {
      requests.current.forEach((r) => r.resolve(r.kind === 'confirm' ? false : null));
      requests.current = [];
    },
    [],
  );
  const finish = (result: string | boolean | null) => {
    const current = requests.current[0];
    if (!current) return;
    requests.current = requests.current.slice(1);
    setQueue(requests.current);
    current.resolve(result);
  };
  const feedback: Feedback = {
    confirm: (message) =>
      new Promise<boolean>((resolve) =>
        enqueue({ kind: 'confirm', message, resolve: (value) => resolve(value === true) }),
      ),
    prompt: (message, initial, labels) =>
      new Promise<string | null>((resolve) =>
        enqueue({
          kind: 'prompt',
          message,
          initial,
          labels,
          resolve: (value) => resolve(typeof value === 'string' ? value : null),
        }),
      ),
    alert: (message) => enqueue({ kind: 'alert', message, resolve: () => {} }),
  };
  return (
    <FeedbackContext.Provider value={feedback}>
      {children}
      {active && (
        <ModalSurface
          className="modal-backdrop"
          onClick={(event) => {
            if (event.currentTarget === event.target)
              finish(active.kind === 'confirm' ? false : null);
          }}
        >
          <form
            className="modal-dialog modal-dialog-sm"
            onSubmit={(event) => {
              event.preventDefault();
              finish(active.kind === 'prompt' ? value : true);
            }}
          >
            <header className="modal-header">
              <h2 className="modal-title">
                {active.kind === 'prompt'
                  ? active.labels?.title || 'Edit answer'
                  : active.kind === 'confirm'
                    ? 'Please confirm'
                    : 'Something needs attention'}
              </h2>
            </header>
            <p style={{ marginBottom: 24 }}>{active.message}</p>
            {active.kind === 'prompt' && (
              <label className="form-group">
                <span className="form-label">{active.labels?.label || 'Answer'}</span>
                <Textarea
                  value={value}
                  onChange={(event) => setValue(event.target.value)}
                  rows={4}
                />
              </label>
            )}
            <footer className="modal-footer">
              {active.kind !== 'alert' && (
                <Button
                  type="button"
                  className="btn-outline"
                  onClick={() => finish(active.kind === 'confirm' ? false : null)}
                >
                  Cancel
                </Button>
              )}
              <Button type="submit" className="btn-primary">
                {active.kind === 'alert'
                  ? 'Close'
                  : active.kind === 'prompt'
                    ? active.labels?.submit || 'Save & approve'
                    : 'Confirm'}
              </Button>
            </footer>
          </form>
        </ModalSurface>
      )}
    </FeedbackContext.Provider>
  );
}
export const useFeedback = () => useContext(FeedbackContext);
