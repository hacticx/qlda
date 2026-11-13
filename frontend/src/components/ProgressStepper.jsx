// Thanh tiến độ 4 bước theo publicStatus
export default function ProgressStepper({ steps, current }) {
  const currentIndex = steps.findIndex((s) => s.key === current);
  return (
    <div className="stepper">
      {steps.map((step, i) => (
        <div key={step.key} className={`step ${i <= currentIndex ? 'done' : ''} ${i === currentIndex ? 'current' : ''}`}>
          <div className="dot">{i <= currentIndex ? '✓' : i + 1}</div>
          {step.label}
        </div>
      ))}
    </div>
  );
}
