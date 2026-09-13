import RegisterTab from '@/components/RegisterTab';
import AiChatBox from '@/components/AiChatBox';

// Poseban tab samo za agenta — otvara ga ikonica u desnoj traci (RightRail.tsx) ili strelica
// „preko celog taba" iz dokovanog prikaza. Obrazac iz Terminal Travel panela (`/ai-asistent`,
// dizajn dok. §6c.0): ISTA komponenta kao u desnom panelu, samo joj `fokus` isključuje
// automatsko čitanje sadržaja ekrana — ovde je ona SAMA taj sadržaj.
//
// Ovo je DRUGO polje za razgovor, sa sopstvenom istorijom: dokovani primerak živi u `Shell.tsx`
// i seli se između desnog panela i donjeg doka, a ovaj se montira i odmontira sa tabom. Spajati
// ih bi značilo da zatvaranje taba briše razgovor vođen u panelu.
export default function AiAgentFokusPage() {
  return (
    <div className="flex h-full flex-col p-6">
      <RegisterTab label="AI agent" />
      <div className="min-h-0 flex-1">
        <AiChatBox fokus />
      </div>
    </div>
  );
}
