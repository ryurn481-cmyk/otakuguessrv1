import { ScreenshotGame } from '@/components/game/screenshot/screenshot-game';
import { Suspense } from 'react';

export default function PanelPage() { return <Suspense><ScreenshotGame clueType="PANEL" /></Suspense>; }
