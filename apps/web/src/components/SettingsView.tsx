import { Card } from '../ui/Primitives.js';
export function SettingsView() {
  return (
    <Card>
      <h2>About Jobee</h2>
      <p>
        Jobee helps you find relevant jobs, prepare truthful applications and track their progress.
      </p>
      <p>
        AI is managed by Jobee. Your saved facts and processing permissions remain under your
        control.
      </p>
      <p>
        Applications are limited to 10 per day. Admins and explicitly designated testers are exempt
        from that daily limit. You can save up to 10 documents.
      </p>
    </Card>
  );
}
