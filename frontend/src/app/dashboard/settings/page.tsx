'use client';

import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { CreditCard, Globe2, Mail, Save, Settings2, ShieldAlert, UserRound } from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/shared/page-header';
import { SectionCard } from '@/components/shared/section-card';
import { FormField } from '@/components/shared/form-field';
import { ErrorState } from '@/components/shared/error-state';
import { useApiMutation } from '@/components/shared/use-api-mutation';
import { Button } from '@/components/ui/button';
import { Input, Textarea } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { api, getErrorMessage } from '@/lib/api';
import type { PlatformSettings } from '@/types/api';

interface SettingsDraft {
  collegeName: string;
  collegeEmail: string;
  collegePhone: string;
  address: string;
  allowSelfRegistration: boolean;
  maintenanceMode: boolean;
  announcementBanner: string;
  website: string;
  instagram: string;
  youtube: string;
  gatewayEnabled: boolean;
  paymentInstructions: string;
}

const EMPTY: SettingsDraft = {
  collegeName: '',
  collegeEmail: '',
  collegePhone: '',
  address: '',
  allowSelfRegistration: false,
  maintenanceMode: false,
  announcementBanner: '',
  website: '',
  instagram: '',
  youtube: '',
  gatewayEnabled: false,
  paymentInstructions: '',
};

export default function SettingsPage() {
  const [draft, setDraft] = useState<SettingsDraft>(EMPTY);
  const [dirty, setDirty] = useState(false);

  const settingsQuery = useQuery({
    queryKey: ['settings'],
    queryFn: () => api.get<PlatformSettings>('/settings'),
  });

  useEffect(() => {
    const settings = settingsQuery.data;
    if (!settings) return;
    setDraft({
      collegeName: settings.collegeName ?? '',
      collegeEmail: settings.collegeEmail ?? '',
      collegePhone: settings.collegePhone ?? '',
      address: settings.address ?? '',
      allowSelfRegistration: Boolean(settings.allowSelfRegistration),
      maintenanceMode: Boolean(settings.maintenanceMode),
      announcementBanner: settings.announcementBanner ?? '',
      website: settings.socialLinks?.website ?? '',
      instagram: settings.socialLinks?.instagram ?? '',
      youtube: settings.socialLinks?.youtube ?? '',
      gatewayEnabled: Boolean(settings.paymentConfig?.gatewayEnabled),
      paymentInstructions: settings.paymentConfig?.paymentInstructions ?? '',
    });
    setDirty(false);
  }, [settingsQuery.data]);

  const update = <K extends keyof SettingsDraft>(key: K, value: SettingsDraft[K]) => {
    setDraft((current) => ({ ...current, [key]: value }));
    setDirty(true);
  };

  const save = async () => {
    setDirty(true);
    try {
      await api.patch('/settings', {
        collegeName: draft.collegeName,
        collegeEmail: draft.collegeEmail || undefined,
        collegePhone: draft.collegePhone || undefined,
        address: draft.address || undefined,
        allowSelfRegistration: draft.allowSelfRegistration,
        maintenanceMode: draft.maintenanceMode,
        announcementBanner: draft.announcementBanner || undefined,
        socialLinks: {
          website: draft.website || undefined,
          instagram: draft.instagram || undefined,
          youtube: draft.youtube || undefined,
        },
        paymentConfig: {
          gatewayEnabled: draft.gatewayEnabled,
          paymentInstructions: draft.paymentInstructions || undefined,
        },
      });
      toast.success('Settings saved');
      setDirty(false);
      await settingsQuery.refetch();
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  if (settingsQuery.error) {
    return (
      <div>
        <PageHeader eyebrow="Administration" title="Platform settings" />
        <ErrorState error={settingsQuery.error} onRetry={() => void settingsQuery.refetch()} />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        eyebrow="Administration"
        title="Platform settings"
        description="College identity, public contact details and payment behaviour."
        actions={
          <Button size="sm" onClick={() => void save()} disabled={!dirty || settingsQuery.isLoading}>
            <Save className="h-4 w-4" /> Save changes
          </Button>
        }
      />

      {settingsQuery.isLoading ? (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, index) => (
            <Skeleton key={index} className="h-40 w-full rounded-card" />
          ))}
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <SectionCard title="College identity" description="Shown across the platform and public pages">
            <div className="space-y-3">
              <FormField label="College name" htmlFor="settings-name" required>
                <Input id="settings-name" value={draft.collegeName} onChange={(event) => update('collegeName', event.target.value)} />
              </FormField>
              <div className="grid gap-3 sm:grid-cols-2">
                <FormField label="Office email" htmlFor="settings-email">
                  <Input id="settings-email" type="email" value={draft.collegeEmail} onChange={(event) => update('collegeEmail', event.target.value)} />
                </FormField>
                <FormField label="Office phone" htmlFor="settings-phone">
                  <Input id="settings-phone" value={draft.collegePhone} onChange={(event) => update('collegePhone', event.target.value)} />
                </FormField>
              </div>
              <FormField label="Address" htmlFor="settings-address">
                <Textarea id="settings-address" rows={2} value={draft.address} onChange={(event) => update('address', event.target.value)} />
              </FormField>
            </div>
          </SectionCard>

          <SectionCard title="Public presence" description="Links shown in the website footer">
            <div className="space-y-3">
              <FormField label="Website" htmlFor="settings-website">
                <Input id="settings-website" value={draft.website} onChange={(event) => update('website', event.target.value)} placeholder="https://…" />
              </FormField>
              <FormField label="Instagram" htmlFor="settings-instagram">
                <Input id="settings-instagram" value={draft.instagram} onChange={(event) => update('instagram', event.target.value)} placeholder="https://instagram.com/…" />
              </FormField>
              <FormField label="YouTube" htmlFor="settings-youtube">
                <Input id="settings-youtube" value={draft.youtube} onChange={(event) => update('youtube', event.target.value)} placeholder="https://youtube.com/…" />
              </FormField>
              <FormField label="Announcement banner" htmlFor="settings-banner" hint="Optional notice shown at the top of the site">
                <Input id="settings-banner" value={draft.announcementBanner} onChange={(event) => update('announcementBanner', event.target.value)} />
              </FormField>
            </div>
          </SectionCard>

          <SectionCard title="Access & operations" description="Control account creation and maintenance">
            <div className="space-y-3">
              <div className="flex items-center justify-between rounded-xl border border-line bg-surface-subtle/50 px-3 py-2.5">
                <div>
                  <p className="flex items-center gap-1.5 text-[12.5px] font-medium text-ink">
                    <UserRound className="h-3.5 w-3.5 text-primary" /> Self registration
                  </p>
                  <p className="text-[11px] text-muted-foreground">Allow students to create their own accounts</p>
                </div>
                <Switch checked={draft.allowSelfRegistration} onCheckedChange={(value) => update('allowSelfRegistration', value)} />
              </div>
              <div className="flex items-center justify-between rounded-xl border border-line bg-surface-subtle/50 px-3 py-2.5">
                <div>
                  <p className="flex items-center gap-1.5 text-[12.5px] font-medium text-ink">
                    <ShieldAlert className="h-3.5 w-3.5 text-danger" /> Maintenance mode
                  </p>
                  <p className="text-[11px] text-muted-foreground">Temporarily restrict access for non-administrators</p>
                </div>
                <Switch checked={draft.maintenanceMode} onCheckedChange={(value) => update('maintenanceMode', value)} />
              </div>
            </div>
          </SectionCard>

          <SectionCard title="Payments" description="Manual verification and gateway readiness">
            <div className="space-y-3">
              <div className="flex items-center justify-between rounded-xl border border-line bg-surface-subtle/50 px-3 py-2.5">
                <div>
                  <p className="flex items-center gap-1.5 text-[12.5px] font-medium text-ink">
                    <CreditCard className="h-3.5 w-3.5 text-primary" /> Online gateway
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    Disabled means participants pay offline and submit a reference for verification
                  </p>
                </div>
                <Switch checked={draft.gatewayEnabled} onCheckedChange={(value) => update('gatewayEnabled', value)} />
              </div>
              <FormField
                label="Payment instructions"
                htmlFor="settings-instructions"
                hint="Shown to participants when paying offline"
              >
                <Textarea
                  id="settings-instructions"
                  rows={4}
                  value={draft.paymentInstructions}
                  onChange={(event) => update('paymentInstructions', event.target.value)}
                  placeholder="Transfer to the college account and submit the UPI reference…"
                />
              </FormField>
              <p className="flex items-start gap-1.5 rounded-lg bg-warning-soft px-3 py-2 text-[11px] leading-relaxed text-warning">
                <Globe2 className="mt-0.5 h-3 w-3 shrink-0" />
                Gateway keys are configured through server environment variables and are never exposed to the browser.
              </p>
            </div>
          </SectionCard>
        </div>
      )}

      {dirty ? (
        <div className="sticky bottom-4 mt-4 flex items-center justify-between gap-3 rounded-xl border border-primary/20 bg-surface px-4 py-3 shadow-raised">
          <p className="flex items-center gap-1.5 text-[12.5px] text-ink-soft">
            <Settings2 className="h-3.5 w-3.5 text-primary" /> You have unsaved changes
          </p>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={() => setDirty(false)}>Dismiss</Button>
            <Button size="sm" onClick={() => void save()}>
              <Save className="h-3.5 w-3.5" /> Save
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
