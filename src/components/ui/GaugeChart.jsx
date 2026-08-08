const SIZE = 200;
const STROKE = 18;
const R = (SIZE - STROKE) / 2;
const CIRC = 2 * Math.PI * R;
// Show 75% of circle (270 degrees)
const ARC = CIRC * 0.75;

function getColor(score) {
  if (score >= 0.75) return '#f43f5e'; // rose
  if (score >= 0.30) return '#f59e0b'; // amber
  return '#10b981';                     // emerald
}

function getLabel(score) {
  if (score >= 0.75) return 'HIGH RISK';
  if (score >= 0.30) return 'REVIEW';
  return 'LOW RISK';
}

export default function GaugeChart({ score = 0, size = 200 }) {
  const scale = size / SIZE;
  const filled = ARC * score;
  const color = getColor(score);
  const label = getLabel(score);
  const pct = Math.round(score * 100);

  // Rotation: start at 135deg (bottom-left), sweep clockwise
  const rotation = 135;

  return (
    <div className="flex flex-col items-center gap-2">
      <div style={{ width: size, height: size * 0.75 }} className="relative overflow-visible">
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${SIZE} ${SIZE}`}
          style={{ transform: `scale(${scale})`, transformOrigin: 'top left' }}
        >
          {/* Track */}
          <circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={R}
            fill="none"
            stroke="rgba(255,255,255,0.06)"
            strokeWidth={STROKE}
            strokeLinecap="round"
            strokeDasharray={`${ARC} ${CIRC - ARC}`}
            strokeDashoffset={0}
            transform={`rotate(${rotation} ${SIZE / 2} ${SIZE / 2})`}
          />
          {/* Filled arc */}
          <circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={R}
            fill="none"
            stroke={color}
            strokeWidth={STROKE}
            strokeLinecap="round"
            strokeDasharray={`${filled} ${CIRC - filled}`}
            strokeDashoffset={0}
            transform={`rotate(${rotation} ${SIZE / 2} ${SIZE / 2})`}
            style={{
              filter: `drop-shadow(0 0 8px ${color}88)`,
              transition: 'stroke-dasharray 0.8s cubic-bezier(0.4,0,0.2,1), stroke 0.4s',
            }}
          />
          {/* Glow dot at tip */}
          <circle
            cx={SIZE / 2 + R * Math.cos((rotation + (score * 270) - 90) * Math.PI / 180)}
            cy={SIZE / 2 + R * Math.sin((rotation + (score * 270) - 90) * Math.PI / 180)}
            r={STROKE / 2 + 2}
            fill={color}
            style={{ filter: `drop-shadow(0 0 6px ${color})` }}
          />
          {/* Center text */}
          <text
            x={SIZE / 2}
            y={SIZE / 2 - 8}
            textAnchor="middle"
            dominantBaseline="middle"
            fill={color}
            fontSize="36"
            fontWeight="700"
            fontFamily="Inter, sans-serif"
            style={{ filter: `drop-shadow(0 0 8px ${color}66)` }}
          >
            {pct}%
          </text>
          <text
            x={SIZE / 2}
            y={SIZE / 2 + 22}
            textAnchor="middle"
            dominantBaseline="middle"
            fill="rgba(148,163,184,0.9)"
            fontSize="13"
            fontWeight="500"
            fontFamily="Inter, sans-serif"
            letterSpacing="1"
          >
            {label}
          </text>
          {/* Scale markers */}
          {[0, 0.3, 0.75, 1].map((mark, i) => {
            const angle = (rotation + mark * 270 - 90) * Math.PI / 180;
            const innerR = R - STROKE / 2 - 4;
            const outerR = R + STROKE / 2 + 6;
            return (
              <line
                key={i}
                x1={SIZE / 2 + innerR * Math.cos(angle)}
                y1={SIZE / 2 + innerR * Math.sin(angle)}
                x2={SIZE / 2 + outerR * Math.cos(angle)}
                y2={SIZE / 2 + outerR * Math.sin(angle)}
                stroke="rgba(255,255,255,0.2)"
                strokeWidth="1.5"
              />
            );
          })}
        </svg>
      </div>
      <div className="flex items-center gap-4 text-xs text-slate-500 font-mono">
        <span className="text-emerald-500">0%</span>
        <span>▶</span>
        <span className="text-amber-500">30%</span>
        <span>▶</span>
        <span className="text-rose-500">75%+</span>
      </div>
    </div>
  );
}
