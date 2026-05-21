// src/components/PulseLogo.stories.tsx
import { PulseLogo, PulseLogoHome, PulseLogoLoading, PulseLogoNav } from './PulseLogo';

export default {
  title: 'Components/PulseLogo',
  component: PulseLogo,
  parameters: {
    layout: 'centered',
  },
};

export const Default = () => <PulseLogo size={64} />;

export const Minimal = () => <PulseLogo size={64} variant="minimal" animated={false} />;

export const Glow = () => <PulseLogo size={64} variant="glow" pulseSpeed="fast" />;

export const Gradient = () => <PulseLogo size={64} variant="gradient" ringCount={3} />;

export const Monochrome = () => <PulseLogo size={64} variant="monochrome" />;

export const Loading = () => <PulseLogoLoading size={80} />;

export const HomeScreen = () => (
  <div className="flex flex-col items-center gap-4 p-8 bg-black">
    <PulseLogoHome size={80} />
    <p className="text-white/60 text-sm">Pulse Transit</p>
  </div>
);

export const NavigationBar = () => (
  <div className="flex gap-8 p-4 bg-black/90 rounded-2xl">
    <PulseLogoNav size={32} active={true} />
    <PulseLogoNav size={32} active={false} />
    <PulseLogoNav size={32} active={false} />
  </div>
);

export const AllSizes = () => (
  <div className="flex items-end gap-4 p-8 bg-black">
    <PulseLogo size={24} />
    <PulseLogo size={32} />
    <PulseLogo size={48} />
    <PulseLogo size={64} />
    <PulseLogo size={96} />
  </div>
);