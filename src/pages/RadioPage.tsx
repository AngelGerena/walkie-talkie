import { useState } from 'react';
import { AlertOverlay } from '../components/AlertOverlay';
import { Faceplate } from '../components/Faceplate';
import { InstallBanner } from '../components/InstallBanner';
import { KeyRow, View } from '../components/KeyRow';
import { Lcd } from '../components/Lcd';
import { PttButton } from '../components/PttButton';
import { RadioProvider } from '../radio/RadioProvider';
import { ChannelsView } from './radio/ChannelsView';
import { EmergencyView } from './radio/EmergencyView';
import { LogView } from './radio/LogView';
import { SettingsView } from './radio/SettingsView';
import { TalkView } from './radio/TalkView';
import { TeamView } from './radio/TeamView';

function Body() {
  const [view, setView] = useState<View>('talk');

  if (view === 'sos') {
    return (
      <div className="radio radio-sos">
        <EmergencyView onClose={() => setView('talk')} />
        <AlertOverlay />
      </div>
    );
  }

  return (
    <div className="radio camo">
      <Faceplate onChannelKnob={() => setView('channels')} />
      <Lcd />
      <main className="radio-middle">
        {view === 'talk' && <TalkView />}
        {view === 'channels' && <ChannelsView onPicked={() => setView('talk')} />}
        {view === 'log' && <LogView />}
        {view === 'team' && <TeamView />}
        {view === 'settings' && <SettingsView />}
      </main>
      <PttButton />
      <KeyRow view={view} onChange={setView} />
      <InstallBanner />
      <AlertOverlay />
    </div>
  );
}

export function RadioPage() {
  return (
    <RadioProvider>
      <Body />
    </RadioProvider>
  );
}
