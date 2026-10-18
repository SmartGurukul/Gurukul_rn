import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Circle, Ellipse, G, Line, Path, Polygon, Rect } from 'react-native-svg';

/**
 * A faint, original subject-themed watermark drawn behind Resource Hub screens, so a physics
 * chapter feels like physics (atoms, waves), chemistry like a lab (flasks, rings), biology like
 * life (leaves, a DNA helix). All shapes are hand-built here - no external or copyrighted art.
 * Kept at low opacity so text and cards stay perfectly readable on top.
 */
type Props = { subjectKey?: string | null; style?: StyleProp<ViewStyle> };

const TINT: Record<string, string> = {
  physics: '#2563EB',
  chemistry: '#0D9488',
  biology: '#16A34A',
  mathematics: '#7C3AED',
  default: '#0F766E',
};

function family(key?: string | null): keyof typeof MOTIFS {
  if (key && key in MOTIFS) return key as keyof typeof MOTIFS;
  return 'default';
}

// viewBox is 360 x 760; motifs are scattered so the pattern reads at any screen height (slice fit).
const MOTIFS = {
  physics: (c: string) => (
    <G stroke={c} strokeWidth={2} fill="none">
      <G>
        <Circle cx={74} cy={120} r={6} fill={c} stroke="none" />
        <Ellipse cx={74} cy={120} rx={40} ry={15} />
        <Ellipse cx={74} cy={120} rx={40} ry={15} transform="rotate(60 74 120)" />
        <Ellipse cx={74} cy={120} rx={40} ry={15} transform="rotate(120 74 120)" />
        <Circle cx={114} cy={120} r={3.5} fill={c} stroke="none" />
      </G>
      <Path d="M20 330 q25 -34 50 0 t50 0 t50 0 t50 0" />
      <G>
        <Circle cx={300} cy={470} r={6} fill={c} stroke="none" />
        <Ellipse cx={300} cy={470} rx={46} ry={17} transform="rotate(30 300 470)" />
        <Ellipse cx={300} cy={470} rx={46} ry={17} transform="rotate(-30 300 470)" />
      </G>
      <Path d="M30 640 q25 -30 50 0 t50 0 t50 0 t50 0 t50 0" />
      <Line x1={250} y1={210} x2={270} y2={210} /><Line x1={260} y1={200} x2={260} y2={220} />
      <Line x1={150} y1={540} x2={168} y2={540} />
    </G>
  ),
  chemistry: (c: string) => (
    <G stroke={c} strokeWidth={2} fill="none">
      <Path d="M70 70 l0 36 l-30 54 a26 26 0 0 0 23 40 l14 0 a26 26 0 0 0 23 -40 l-30 -54 l0 -36" />
      <Line x1={62} y1={70} x2={98} y2={70} />
      <G>
        <Polygon points="300,120 328,136 328,168 300,184 272,168 272,136" />
        <Circle cx={300} cy={152} r={13} />
      </G>
      <Rect x={60} y={430} width={26} height={70} rx={12} />
      <Rect x={96} y={450} width={26} height={60} rx={12} />
      <G>
        <Circle cx={290} cy={520} r={9} /><Circle cx={330} cy={500} r={6} /><Circle cx={330} cy={545} r={6} />
        <Line x1={298} y1={515} x2={325} y2={503} /><Line x1={298} y1={527} x2={325} y2={542} />
      </G>
      <Path d="M30 300 q25 0 25 24" />
    </G>
  ),
  biology: (c: string) => (
    <G stroke={c} strokeWidth={2} fill="none">
      <Path d="M70 80 C 40 120, 40 180, 80 200 C 120 180, 120 120, 70 80 Z" />
      <Path d="M78 92 C 78 130, 80 170, 82 196" />
      <G>
        <Path d="M300 110 C 340 140, 260 170, 300 200 C 340 230, 260 260, 300 290" />
        <Path d="M340 110 C 300 140, 380 170, 340 200 C 300 230, 380 260, 340 290" />
        <Line x1={306} y1={128} x2={334} y2={128} /><Line x1={300} y1={170} x2={340} y2={170} />
        <Line x1={306} y1={212} x2={334} y2={212} /><Line x1={300} y1={254} x2={340} y2={254} />
      </G>
      <G>
        <Circle cx={80} cy={470} r={34} /><Circle cx={80} cy={470} r={10} fill={c} stroke="none" />
        <Circle cx={150} cy={540} r={22} /><Circle cx={150} cy={540} r={7} fill={c} stroke="none" />
      </G>
      <Path d="M250 600 C 220 640, 220 700, 260 720 C 300 700, 300 640, 250 600 Z" />
    </G>
  ),
  mathematics: (c: string) => (
    <G stroke={c} strokeWidth={2} fill="none">
      <G strokeWidth={1}>
        <Line x1={40} y1={110} x2={200} y2={110} /><Line x1={40} y1={150} x2={200} y2={150} /><Line x1={40} y1={190} x2={200} y2={190} />
        <Line x1={80} y1={90} x2={80} y2={210} /><Line x1={120} y1={90} x2={120} y2={210} /><Line x1={160} y1={90} x2={160} y2={210} />
      </G>
      <Path d="M30 200 Q 120 40 210 200" />
      <Path d="M250 520 q24 -40 48 0 t48 0" />
      <Circle cx={300} cy={300} r={30} />
      <Path d="M60 600 l60 0 M60 560 l0 80 M120 560 l0 80" />
    </G>
  ),
  default: (c: string) => (
    <G stroke={c} strokeWidth={2} fill="none">
      <Circle cx={80} cy={130} r={30} /><Circle cx={300} cy={220} r={20} />
      <Circle cx={120} cy={430} r={24} /><Circle cx={300} cy={560} r={30} />
      <Circle cx={60} cy={640} r={16} /><Circle cx={230} cy={360} r={12} />
    </G>
  ),
};

export function SubjectBackdrop({ subjectKey, style }: Props) {
  const fam = family(subjectKey);
  const tint = TINT[fam] ?? TINT.default;
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.wrap, style]}>
      <Svg width="100%" height="100%" viewBox="0 0 360 760" preserveAspectRatio="xMidYMid slice">
        {MOTIFS[fam](tint)}
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { opacity: 0.07 },
});
