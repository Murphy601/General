import { PlatformLayout } from '@/components/PlatformLayout';
import { StudioPanel } from '@/components/StudioPanel';

export default function StudioPage() {
  return (
    <PlatformLayout active="/studio">
      <StudioPanel />
    </PlatformLayout>
  );
}
