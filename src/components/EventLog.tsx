"use client";

function classifyLine(line: string): string {
  if (line.includes("═══") || line.includes("───"))
    return "text-green-600 font-bold";
  if (line.includes("STARVATION") || line.includes("BANKRUPTCY") || line.includes("DEFICIT") || line.includes("COLLAPSED") || line.includes("COUP"))
    return "text-red-400 font-bold";
  if (line.includes("RANDOM EVENT") || line.includes("JACKPOT") || line.includes("VICTORY"))
    return "text-yellow-400";
  if (line.includes("DEFEAT") || line.includes("REPELLED"))
    return "text-orange-400";
  if (line.includes("AI TURNS"))
    return "text-blue-400";
  if (line.includes("◈"))
    return "text-blue-300";
  if (line.includes("⚡"))
    return "text-yellow-300";
  if (line.includes("TURN") && line.includes("REPORT"))
    return "text-yellow-400 font-bold";
  if (line.includes("INCOME:"))
    return "text-green-300";
  if (line.includes("EXPENSES:"))
    return "text-red-300";
  if (line.includes("NET:"))
    return line.includes("-") ? "text-red-400 font-bold" : "text-green-400 font-bold";
  if (line.includes("POPULATION:"))
    return "text-cyan-300";
  if (line.includes("RESOURCES:"))
    return "text-green-500";
  if (line.trimStart().startsWith("▸"))
    return "text-yellow-300";
  if (line.trimStart().startsWith("Tax revenue") || line.trimStart().startsWith("Urban tax") || line.trimStart().startsWith("Tourism") || line.trimStart().startsWith("Market sales") || line.trimStart().startsWith("Redistribution"))
    return "text-green-500";
  if (line.trimStart().startsWith("Planet maintenance") || line.trimStart().startsWith("Military upkeep") || line.trimStart().startsWith("Galactic tax"))
    return "text-red-400/80";
  if (line.trimStart().startsWith("Births") || line.trimStart().startsWith("Immigration"))
    return "text-cyan-400";
  if (line.trimStart().startsWith("Deaths") || line.trimStart().startsWith("Emigration"))
    return "text-orange-300";
  return "text-green-400";
}

export default function EventLog({ events }: { events: string[] }) {
  return (
    <div className="border border-green-800 p-4 h-full flex flex-col">
      <h2 className="text-yellow-400 font-bold mb-3 tracking-wider">[ COMM CHANNEL ]</h2>
      <div className="space-y-0 overflow-y-auto flex-1 font-mono">
        {events.length === 0 && (
          <p className="text-green-800 text-sm italic">Awaiting transmissions...</p>
        )}
        {events.map((e, i) => (
          <p
            key={i}
            className={`text-xs leading-relaxed whitespace-pre ${classifyLine(e)}`}
          >
            {e}
          </p>
        ))}
      </div>
    </div>
  );
}
