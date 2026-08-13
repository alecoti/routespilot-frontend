"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Archive,
  Building2,
  Check,
  Loader2,
  MapPin,
  RotateCcw,
  Save,
  Settings,
  Truck,
} from "lucide-react";

import {
  archiveLocationTemplate,
  archiveVehicleTemplate,
  createLocationTemplate,
  createVehicleTemplate,
  getOrganizationSettings,
  listLocationTemplates,
  listVehicleTemplates,
  restoreLocationTemplate,
  restoreVehicleTemplate,
  updateOrganizationSettings,
  type LocationTemplate,
  type LocationTemplateType,
  type OrganizationSettings,
  type VehicleTemplate,
} from "@/lib/api/organization-config";
import { hasPersistenceContext } from "@/lib/api/persistence-context";
import { cn } from "@/lib/utils";

const locationTypes: LocationTemplateType[] = [
  "depot",
  "warehouse",
  "branch",
  "supplier",
  "other",
];

export function SettingsPageContent() {
  const persistenceConfigured = hasPersistenceContext();
  const [settings, setSettings] = useState<OrganizationSettings | null>(null);
  const [locations, setLocations] = useState<LocationTemplate[]>([]);
  const [vehicles, setVehicles] = useState<VehicleTemplate[]>([]);
  const [currency, setCurrency] = useState("EUR");
  const [timezone, setTimezone] = useState("Europe/Rome");
  const [returnToDepot, setReturnToDepot] = useState(true);
  const [defaultDepotId, setDefaultDepotId] = useState("");
  const [locationForm, setLocationForm] = useState({
    name: "",
    address: "",
    locationType: "depot" as LocationTemplateType,
    latitude: "",
    longitude: "",
  });
  const [vehicleForm, setVehicleForm] = useState({
    name: "",
    externalReference: "",
    weight: "",
    pallets: "",
    fixedCost: "",
    costPerKm: "",
    costPerHour: "",
  });
  const [includeArchived, setIncludeArchived] = useState(false);
  const [loading, setLoading] = useState(persistenceConfigured);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const loadSettings = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [settingsPayload, locationItems, vehicleItems] =
        await Promise.all([
          getOrganizationSettings(),
          listLocationTemplates(includeArchived),
          listVehicleTemplates(includeArchived),
        ]);

      setSettings(settingsPayload);
      setCurrency(settingsPayload.defaultCurrency);
      setTimezone(settingsPayload.defaultTimezone);
      setReturnToDepot(settingsPayload.defaultReturnToDepot);
      setDefaultDepotId(settingsPayload.defaultDepotLocationId ?? "");
      setLocations(locationItems);
      setVehicles(vehicleItems);
    } catch {
      setError("We couldn't load organization settings.");
    } finally {
      setLoading(false);
    }
  }, [includeArchived]);

  useEffect(() => {
    if (!persistenceConfigured) {
      return;
    }

    const timeout = window.setTimeout(() => {
      void loadSettings();
    }, 0);

    return () => window.clearTimeout(timeout);
  }, [loadSettings, persistenceConfigured]);

  async function saveGeneralSettings() {
    setSaving("settings");
    setError(null);
    setNotice(null);

    try {
      const updated = await updateOrganizationSettings({
        defaultCurrency: currency,
        defaultTimezone: timezone,
        defaultReturnToDepot: returnToDepot,
        defaultDepotLocationId: defaultDepotId || null,
      });

      setSettings(updated);
      setNotice("Organization defaults saved.");
    } catch {
      setError("We couldn't save these defaults.");
    } finally {
      setSaving(null);
    }
  }

  async function addLocationTemplate() {
    setSaving("location");
    setError(null);
    setNotice(null);

    try {
      const latitude = parseOptionalNumber(locationForm.latitude);
      const longitude = parseOptionalNumber(locationForm.longitude);
      const created = await createLocationTemplate({
        name: locationForm.name,
        address: locationForm.address,
        locationType: locationForm.locationType,
        latitude,
        longitude,
      });

      setLocations((current) => [...current, created]);
      setLocationForm({
        name: "",
        address: "",
        locationType: "depot",
        latitude: "",
        longitude: "",
      });
      setNotice("Location template saved.");
    } catch {
      setError("We couldn't save this location. Check the address or coordinates.");
    } finally {
      setSaving(null);
    }
  }

  async function setAsDefaultDepot(locationId: string) {
    setSaving(locationId);
    setError(null);
    setNotice(null);

    try {
      const updated = await updateOrganizationSettings({
        defaultDepotLocationId: locationId,
      });

      setSettings(updated);
      setDefaultDepotId(locationId);
      setNotice("Default depot updated.");
    } catch {
      setError("We couldn't set that default depot.");
    } finally {
      setSaving(null);
    }
  }

  async function toggleLocationArchive(template: LocationTemplate) {
    setSaving(template.id);
    setError(null);

    try {
      const updated = template.isActive
        ? await archiveLocationTemplate(template.id)
        : await restoreLocationTemplate(template.id);

      setLocations((current) =>
        current
          .map((item) => (item.id === updated.id ? updated : item))
          .filter((item) => includeArchived || item.isActive),
      );

      if (settings?.defaultDepotLocationId === template.id && template.isActive) {
        setDefaultDepotId("");
      }
    } catch {
      setError("We couldn't update this location template.");
    } finally {
      setSaving(null);
    }
  }

  async function addVehicleTemplate() {
    setSaving("vehicle");
    setError(null);
    setNotice(null);

    try {
      const capacities: Record<string, number> = {};
      const capacityDimensions = [];
      const weight = parseOptionalNumber(vehicleForm.weight);
      const pallets = parseOptionalNumber(vehicleForm.pallets);

      if (typeof weight === "number") {
        capacities.weight = weight;
        capacityDimensions.push({
          key: "weight",
          label: "Weight",
          unit: "kg",
          valueType: "decimal" as const,
        });
      }

      if (typeof pallets === "number") {
        capacities.pallets = pallets;
        capacityDimensions.push({
          key: "pallets",
          label: "Pallets",
          unit: "pallets",
          valueType: "integer" as const,
        });
      }

      const operatingCost = {
        fixedCost: parseOptionalNumber(vehicleForm.fixedCost),
        costPerKm: parseOptionalNumber(vehicleForm.costPerKm),
        costPerHour: parseOptionalNumber(vehicleForm.costPerHour),
      };
      const hasOperatingCost = Object.values(operatingCost).some(
        (value) => typeof value === "number",
      );
      const created = await createVehicleTemplate({
        name: vehicleForm.name,
        externalReference: vehicleForm.externalReference || null,
        capacities,
        capacityDimensions,
        operatingCost: hasOperatingCost ? operatingCost : null,
      });

      setVehicles((current) => [...current, created]);
      setVehicleForm({
        name: "",
        externalReference: "",
        weight: "",
        pallets: "",
        fixedCost: "",
        costPerKm: "",
        costPerHour: "",
      });
      setNotice("Vehicle template saved.");
    } catch {
      setError("We couldn't save this vehicle template.");
    } finally {
      setSaving(null);
    }
  }

  async function toggleVehicleArchive(template: VehicleTemplate) {
    setSaving(template.id);
    setError(null);

    try {
      const updated = template.isActive
        ? await archiveVehicleTemplate(template.id)
        : await restoreVehicleTemplate(template.id);

      setVehicles((current) =>
        current
          .map((item) => (item.id === updated.id ? updated : item))
          .filter((item) => includeArchived || item.isActive),
      );
    } catch {
      setError("We couldn't update this vehicle template.");
    } finally {
      setSaving(null);
    }
  }

  const activeDepotOptions = useMemo(
    () =>
      locations.filter(
        (location) =>
          location.isActive &&
          ["depot", "warehouse", "branch"].includes(location.locationType),
      ),
    [locations],
  );

  if (!persistenceConfigured) {
    return (
      <SettingsShell>
        <EmptySettingsState />
      </SettingsShell>
    );
  }

  return (
    <SettingsShell>
      {error ? <Feedback tone="error">{error}</Feedback> : null}
      {notice ? <Feedback tone="success">{notice}</Feedback> : null}

      {loading ? (
        <div className="flex min-h-80 items-center justify-center rounded-lg border border-border bg-card">
          <Loader2
            aria-hidden
            className="h-5 w-5 animate-spin text-primary-accent"
          />
        </div>
      ) : (
        <div className="grid gap-5 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <section className="rounded-lg border border-border bg-card p-5">
            <SectionHeading
              icon={<Settings aria-hidden className="h-5 w-5" />}
              title="General"
              description="Defaults used when a new optimization is created."
            />

            <div className="mt-5 grid gap-4">
              <label className="grid gap-2 text-sm">
                <span className="font-display font-semibold text-foreground">
                  Currency
                </span>
                <input
                  className="h-11 rounded-lg border border-border bg-background px-3 uppercase outline-none focus:border-primary-accent"
                  maxLength={3}
                  onChange={(event) => setCurrency(event.target.value)}
                  value={currency}
                />
              </label>

              <label className="grid gap-2 text-sm">
                <span className="font-display font-semibold text-foreground">
                  Timezone
                </span>
                <input
                  className="h-11 rounded-lg border border-border bg-background px-3 outline-none focus:border-primary-accent"
                  onChange={(event) => setTimezone(event.target.value)}
                  value={timezone}
                />
              </label>

              <label className="grid gap-2 text-sm">
                <span className="font-display font-semibold text-foreground">
                  Default depot
                </span>
                <select
                  className="h-11 rounded-lg border border-border bg-background px-3 outline-none focus:border-primary-accent"
                  onChange={(event) => setDefaultDepotId(event.target.value)}
                  value={defaultDepotId}
                >
                  <option value="">No default depot</option>
                  {activeDepotOptions.map((location) => (
                    <option key={location.id} value={location.id}>
                      {location.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="flex items-center gap-3 rounded-lg border border-border bg-surface px-3 py-3 text-sm">
                <input
                  checked={returnToDepot}
                  className="h-4 w-4 accent-primary-accent"
                  onChange={(event) => setReturnToDepot(event.target.checked)}
                  type="checkbox"
                />
                <span className="font-display font-semibold text-foreground">
                  Return to depot by default
                </span>
              </label>

              <button
                className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-primary-accent px-4 font-display text-sm font-bold text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={saving === "settings"}
                onClick={() => void saveGeneralSettings()}
                type="button"
              >
                {saving === "settings" ? (
                  <Loader2 aria-hidden className="h-4 w-4 animate-spin" />
                ) : (
                  <Save aria-hidden className="h-4 w-4" />
                )}
                Save defaults
              </button>
            </div>
          </section>

          <section className="rounded-lg border border-border bg-card p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <SectionHeading
                icon={<MapPin aria-hidden className="h-5 w-5" />}
                title="Locations"
                description="Reusable depots, warehouses and supplier addresses."
              />
              <ArchiveToggle
                checked={includeArchived}
                onChange={setIncludeArchived}
              />
            </div>

            <div className="mt-5 grid gap-3">
              {locations.map((location) => (
                <TemplateRow
                  actionLabel={
                    location.isActive ? "Archive location" : "Restore location"
                  }
                  archived={!location.isActive}
                  icon={<Building2 aria-hidden className="h-4 w-4" />}
                  key={location.id}
                  meta={`${titleCase(location.locationType)} | ${location.address}`}
                  onAction={() => void toggleLocationArchive(location)}
                  title={location.name}
                >
                  {location.isActive ? (
                    <button
                      className={cn(
                        "inline-flex h-9 items-center justify-center rounded-lg border px-3 font-display text-xs font-semibold",
                        defaultDepotId === location.id
                          ? "border-primary-accent/30 bg-primary-accent/10 text-primary-accent"
                          : "border-border text-foreground hover:bg-surface-low",
                      )}
                      disabled={saving === location.id}
                      onClick={() => void setAsDefaultDepot(location.id)}
                      type="button"
                    >
                      {defaultDepotId === location.id ? "Default depot" : "Set depot"}
                    </button>
                  ) : null}
                </TemplateRow>
              ))}
            </div>

            <div className="mt-5 rounded-lg border border-border bg-surface p-4">
              <p className="font-display text-sm font-semibold text-foreground">
                Add location
              </p>
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                <TextInput
                  label="Name"
                  onChange={(value) =>
                    setLocationForm((current) => ({ ...current, name: value }))
                  }
                  value={locationForm.name}
                />
                <label className="grid gap-1 text-sm">
                  <span className="font-display text-xs font-semibold text-muted-foreground">
                    Type
                  </span>
                  <select
                    className="h-10 rounded-lg border border-border bg-background px-3 outline-none focus:border-primary-accent"
                    onChange={(event) =>
                      setLocationForm((current) => ({
                        ...current,
                        locationType: event.target.value as LocationTemplateType,
                      }))
                    }
                    value={locationForm.locationType}
                  >
                    {locationTypes.map((type) => (
                      <option key={type} value={type}>
                        {titleCase(type)}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="md:col-span-2">
                  <TextInput
                    label="Address"
                    onChange={(value) =>
                      setLocationForm((current) => ({
                        ...current,
                        address: value,
                      }))
                    }
                    value={locationForm.address}
                  />
                </div>
                <TextInput
                  label="Latitude"
                  onChange={(value) =>
                    setLocationForm((current) => ({ ...current, latitude: value }))
                  }
                  value={locationForm.latitude}
                />
                <TextInput
                  label="Longitude"
                  onChange={(value) =>
                    setLocationForm((current) => ({ ...current, longitude: value }))
                  }
                  value={locationForm.longitude}
                />
              </div>
              <button
                className="mt-3 inline-flex h-10 items-center justify-center rounded-lg bg-primary-accent px-4 font-display text-sm font-bold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-60"
                disabled={
                  saving === "location" ||
                  !locationForm.name.trim() ||
                  !locationForm.address.trim()
                }
                onClick={() => void addLocationTemplate()}
                type="button"
              >
                Add location
              </button>
            </div>
          </section>

          <section className="rounded-lg border border-border bg-card p-5 xl:col-span-2">
            <SectionHeading
              icon={<Truck aria-hidden className="h-5 w-5" />}
              title="Vehicle templates"
              description="Reusable vehicles copied into each new optimization."
            />

            <div className="mt-5 grid gap-3 lg:grid-cols-2">
              {vehicles.map((vehicle) => (
                <TemplateRow
                  actionLabel={
                    vehicle.isActive ? "Archive vehicle" : "Restore vehicle"
                  }
                  archived={!vehicle.isActive}
                  icon={<Truck aria-hidden className="h-4 w-4" />}
                  key={vehicle.id}
                  meta={vehicleMeta(vehicle)}
                  onAction={() => void toggleVehicleArchive(vehicle)}
                  title={vehicle.name}
                />
              ))}
            </div>

            <div className="mt-5 rounded-lg border border-border bg-surface p-4">
              <p className="font-display text-sm font-semibold text-foreground">
                Add vehicle
              </p>
              <div className="mt-3 grid gap-3 md:grid-cols-3">
                <TextInput
                  label="Name"
                  onChange={(value) =>
                    setVehicleForm((current) => ({ ...current, name: value }))
                  }
                  value={vehicleForm.name}
                />
                <TextInput
                  label="Reference"
                  onChange={(value) =>
                    setVehicleForm((current) => ({
                      ...current,
                      externalReference: value,
                    }))
                  }
                  value={vehicleForm.externalReference}
                />
                <TextInput
                  label="Weight capacity kg"
                  onChange={(value) =>
                    setVehicleForm((current) => ({ ...current, weight: value }))
                  }
                  value={vehicleForm.weight}
                />
                <TextInput
                  label="Pallets"
                  onChange={(value) =>
                    setVehicleForm((current) => ({ ...current, pallets: value }))
                  }
                  value={vehicleForm.pallets}
                />
                <TextInput
                  label="Fixed cost"
                  onChange={(value) =>
                    setVehicleForm((current) => ({ ...current, fixedCost: value }))
                  }
                  value={vehicleForm.fixedCost}
                />
                <TextInput
                  label="Cost per km"
                  onChange={(value) =>
                    setVehicleForm((current) => ({ ...current, costPerKm: value }))
                  }
                  value={vehicleForm.costPerKm}
                />
                <TextInput
                  label="Cost per hour"
                  onChange={(value) =>
                    setVehicleForm((current) => ({ ...current, costPerHour: value }))
                  }
                  value={vehicleForm.costPerHour}
                />
              </div>
              <button
                className="mt-3 inline-flex h-10 items-center justify-center rounded-lg bg-primary-accent px-4 font-display text-sm font-bold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-60"
                disabled={saving === "vehicle" || !vehicleForm.name.trim()}
                onClick={() => void addVehicleTemplate()}
                type="button"
              >
                Add vehicle
              </button>
            </div>
          </section>
        </div>
      )}
    </SettingsShell>
  );
}

function SettingsShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex max-w-[1440px] flex-col gap-6 px-4 py-8 md:px-6 md:py-10">
      <header className="border-b border-border pb-4">
        <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-lg border border-border bg-surface">
          <Settings aria-hidden className="h-5 w-5 text-primary-accent" />
        </div>
        <h1 className="font-display text-3xl font-semibold text-foreground md:text-4xl">
          Settings
        </h1>
        <p className="mt-2 max-w-2xl text-base leading-7 text-muted-foreground">
          Configure organization defaults, reusable locations and vehicle templates.
        </p>
      </header>
      {children}
    </div>
  );
}

function EmptySettingsState() {
  return (
    <section className="rounded-lg border border-border bg-card p-6">
      <h2 className="font-display text-xl font-semibold text-foreground">
        Settings are not connected
      </h2>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
        Set NEXT_PUBLIC_ROUTESPILOT_ORGANIZATION_ID to manage organization
        defaults and reusable templates.
      </p>
    </section>
  );
}

function SectionHeading({
  description,
  icon,
  title,
}: {
  description: string;
  icon: React.ReactNode;
  title: string;
}) {
  return (
    <div className="flex gap-3">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-border bg-surface text-primary-accent">
        {icon}
      </div>
      <div>
        <h2 className="font-display text-xl font-semibold text-foreground">
          {title}
        </h2>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">
          {description}
        </p>
      </div>
    </div>
  );
}

function TemplateRow({
  actionLabel,
  archived,
  children,
  icon,
  meta,
  onAction,
  title,
}: {
  actionLabel: string;
  archived: boolean;
  children?: React.ReactNode;
  icon: React.ReactNode;
  meta: string;
  onAction: () => void;
  title: string;
}) {
  return (
    <article
      className={cn(
        "flex flex-col gap-3 rounded-lg border border-border bg-background p-4 sm:flex-row sm:items-center sm:justify-between",
        archived && "opacity-60",
      )}
    >
      <div className="flex min-w-0 gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-surface text-muted-foreground">
          {icon}
        </div>
        <div className="min-w-0">
          <h3 className="truncate font-display text-sm font-semibold text-foreground">
            {title}
          </h3>
          <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{meta}</p>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {children}
        <button
          aria-label={actionLabel}
          className="inline-flex h-9 items-center justify-center rounded-lg border border-border px-3 text-muted-foreground transition-colors hover:bg-surface-low hover:text-foreground"
          onClick={onAction}
          type="button"
        >
          {archived ? (
            <RotateCcw aria-hidden className="h-4 w-4" />
          ) : (
            <Archive aria-hidden className="h-4 w-4" />
          )}
        </button>
      </div>
    </article>
  );
}

function TextInput({
  label,
  onChange,
  value,
}: {
  label: string;
  onChange: (value: string) => void;
  value: string;
}) {
  return (
    <label className="grid gap-1 text-sm">
      <span className="font-display text-xs font-semibold text-muted-foreground">
        {label}
      </span>
      <input
        className="h-10 rounded-lg border border-border bg-background px-3 outline-none focus:border-primary-accent"
        onChange={(event) => onChange(event.target.value)}
        value={value}
      />
    </label>
  );
}

function ArchiveToggle({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-sm text-muted-foreground">
      <input
        checked={checked}
        className="h-4 w-4 accent-primary-accent"
        onChange={(event) => onChange(event.target.checked)}
        type="checkbox"
      />
      Include archived
    </label>
  );
}

function Feedback({
  children,
  tone,
}: {
  children: React.ReactNode;
  tone: "error" | "success";
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-lg border px-4 py-3 text-sm",
        tone === "error" &&
          "border-destructive/20 bg-destructive/10 text-destructive",
        tone === "success" &&
          "border-primary-accent/20 bg-primary-accent/10 text-primary-accent",
      )}
    >
      {tone === "success" ? <Check aria-hidden className="h-4 w-4" /> : null}
      {children}
    </div>
  );
}

function vehicleMeta(vehicle: VehicleTemplate) {
  const capacity = Object.entries(vehicle.capacities)
    .map(([key, value]) => `${value} ${dimensionUnit(vehicle, key)}`.trim())
    .join(" | ");
  const costs = vehicle.operatingCost
    ? [
        vehicle.operatingCost.fixedCost
          ? `${vehicle.operatingCost.fixedCost} fixed`
          : null,
        vehicle.operatingCost.costPerKm
          ? `${vehicle.operatingCost.costPerKm}/km`
          : null,
        vehicle.operatingCost.costPerHour
          ? `${vehicle.operatingCost.costPerHour}/hour`
          : null,
      ]
        .filter(Boolean)
        .join(" | ")
    : "";

  return [capacity || "No capacity set", costs].filter(Boolean).join(" | ");
}

function dimensionUnit(vehicle: VehicleTemplate, key: string) {
  return (
    vehicle.capacityDimensions.find((dimension) => dimension.key === key)?.unit ??
    key
  );
}

function parseOptionalNumber(value: string) {
  if (!value.trim()) {
    return undefined;
  }

  const parsed = Number(value.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : undefined;
}

function titleCase(value: string) {
  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}
