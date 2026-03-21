"use client";

interface Props {
  deliveryURI: string;
}

export default function DeliverablePreview({ deliveryURI }: Props) {
  if (!deliveryURI) return null;

  let data: Record<string, unknown> = {};
  try {
    const raw = deliveryURI.replace("data:application/json,", "");
    data = JSON.parse(decodeURIComponent(raw));
  } catch {
    try {
      const raw = deliveryURI.replace("data:application/json,", "");
      data = JSON.parse(raw);
    } catch {
      // show raw
    }
  }

  const output = data.output || data.result || data.content || data.answer;
  const summary = data.summary || data.title;
  const keys = Object.keys(data).filter((k) => !["output", "result", "content", "answer", "summary", "title", "deliveredAt", "dealId"].includes(k));

  return (
    <div className="border border-[#C084FC]/20 bg-[rgba(192,132,252,0.03)]">
      <div className="px-5 py-3 border-b border-[#C084FC]/20 flex items-center justify-between">
        <span className="font-mono text-[10px] text-[#C084FC] tracking-widest">
          DELIVERABLE OUTPUT
        </span>
        <span className="font-mono text-[10px] text-[#3A4558]">AI GENERATED</span>
      </div>

      <div className="px-5 py-5 space-y-4">
        {summary != null && (
          <div>
            <div className="font-mono text-[10px] text-[#3A4558] tracking-widest mb-1">SUMMARY</div>
            <div className="font-mono text-sm text-[#E8EFF8]">{String(summary)}</div>
          </div>
        )}

        {output != null && (
          <div>
            <div className="font-mono text-[10px] text-[#3A4558] tracking-widest mb-2">OUTPUT</div>
            <div className="bg-[#050608] border border-[#1C2230] px-4 py-4 max-h-80 overflow-y-auto">
              <pre className="font-mono text-xs text-[#E8EFF8] whitespace-pre-wrap break-words leading-relaxed">
                {String(output)}
              </pre>
            </div>
          </div>
        )}

        {keys.map((k) => {
          const val = data[k];
          const strVal = typeof val === "object" ? JSON.stringify(val, null, 2) : String(val);
          return (
            <div key={k}>
              <div className="font-mono text-[10px] text-[#3A4558] tracking-widest mb-1">
                {k.toUpperCase()}
              </div>
              {strVal.length > 120 ? (
                <div className="bg-[#050608] border border-[#1C2230] px-4 py-3 max-h-48 overflow-y-auto">
                  <pre className="font-mono text-xs text-[#E8EFF8] whitespace-pre-wrap break-words">
                    {strVal}
                  </pre>
                </div>
              ) : (
                <div className="font-mono text-xs text-[#E8EFF8]">{strVal}</div>
              )}
            </div>
          );
        })}

        {!output && !summary && keys.length === 0 && (
          <div className="font-mono text-xs text-[#3A4558]">
            {deliveryURI.startsWith("data:") ? "Unable to parse deliverable." : deliveryURI}
          </div>
        )}
      </div>
    </div>
  );
}
