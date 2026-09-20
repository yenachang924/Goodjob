'use client';

import { useEffect, useState } from 'react';
import ControlWorkspace from './control-workspace';
import { cloudCallbackPath } from './entry-routing';

export function LocalEntry() {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const target = cloudCallbackPath(
      window.location.hash,
      window.location.search,
    );
    if (target) window.location.replace(target);
    else setReady(true);
  }, []);
  if (!ready)
    return (
      <main className="control-shell">
        <p role="status">워크스페이스를 여는 중…</p>
      </main>
    );
  return <ControlWorkspace mode="local" />;
}
