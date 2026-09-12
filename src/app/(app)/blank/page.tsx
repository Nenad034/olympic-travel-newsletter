import RegisterTab from '@/components/RegisterTab';

export default function BlankPage() {
  return (
    <div className="flex h-full items-center justify-center p-6 text-xs text-ink-faint">
      <RegisterTab label="Novi tab" />
      Prazan tab — izaberi sekciju u levoj traci ili pritisni Ctrl T.
    </div>
  );
}
