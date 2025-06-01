const baseURL = "http://localhost:8080";

export enum Impact {
  ImpactNone = "none",
  ImpactMinor = "minor",
  ImpactMajor = "major",
}
export enum IncidentStatus {
  StatusInvestigating = "investigating",
  StatusIdentified = "identified",
  StatusMonitoring = "monitoring",
  StatusResolved = "resolved",
}

export interface IncidentUpdate {
  id: string;
  text: string;
  status: string;
  timestamp: Date;
}

export interface Incident {
  id: string;
  timestamp: Date;
  status: IncidentStatus;
  impact: Impact;

  name: string;
  description: string;

  last_update: Date;
  resolution_timestamp: Date;

  updates: IncidentUpdate[];
}

export interface IncidentList {
  timestamp: Date;
  incidents: Map<string, Incident>;
}

export interface IncidentPatch {
  name: string | undefined;
  description: string | undefined;
  status: IncidentStatus | undefined;
  impact: Impact | undefined;
}

export function genIncidentEmbed(incident: Incident) {
  let color: number;
  switch (incident.impact) {
    case Impact.ImpactMinor:
      color = 0xfcb700;
      break;
    case Impact.ImpactMajor:
      color = 0xff637d;
      break;
    default:
      color = 0x99c1f1;
      break;
  }
  return {
    author: {
      name: "PluralKit Status",
      url: "https://status.pluralkit.me/",
    },
    title: incident.name,
    description: incident.description,
    color: color,
    fields: [
      {
        name: "status",
        value: incident.status,
        inline: true,
      },
      {
        name: "impact",
        value: incident.impact,
        inline: true,
      },
    ],
    footer: {
      text: `incident id: ${incident.id}`,
    },
    timestamp: incident.timestamp.toISOString(),
  };
}

export function genUpdateEmbed(incident: Incident, update: IncidentUpdate) {
  return {
    author: {
      name: "PluralKit Status",
      url: "https://status.pluralkit.me/",
    },
    title: `update: "${incident.name}"`,
    description: update.text,
    footer: {
      text: `update id: ${update.id} | incident id: ${incident.id}`,
    },
    timestamp: update.timestamp.toISOString(),
  };
}

/**
 * gets the currently active incidents
 *
 * @returns a map of active incidents
 */
export async function getActiveIncidents() {
  const response = await fetch(`${baseURL}/api/v1/incidents/active`);
  const data = (await response.json()) as IncidentList;
  const entries = Object.entries(data.incidents).map(
    ([id, incidentData]: [string, any]) => {
      const incident: Incident = {
        ...incidentData,
        timestamp: new Date(incidentData.timestamp),
        last_update: new Date(incidentData.last_update),
        resolution_timestamp: incidentData.resolution_timestamp
          ? new Date(incidentData.resolution_timestamp)
          : null,
        updates: (incidentData.updates || []).map((update: any) => ({
          ...update,
          timestamp: new Date(update.timestamp),
        })),
      };
      return [id, incident] as [string, Incident];
    },
  );
  let incidents = new Map<string, Incident>(entries);
  return incidents;
}

/**
 * gets a specified incident by id
 *
 * @param id - the id of the incident to retrieve
 * @returns the specified incident as an Incident
 */
export async function getIncident(id: string): Promise<Incident> {
  const response = await fetch(`${baseURL}/api/v1/incidents/${id}`);
  if (!response.ok) {
    const data = await response.text();
    throw new Error(`response ${response.status}: ${data}`);
  }
  const data = (await response.json()) as Incident;
  return {
    ...data,
    timestamp: new Date(data.timestamp),
    last_update: new Date(data.last_update),
    resolution_timestamp: data.resolution_timestamp
      ? new Date(data.resolution_timestamp)
      : null,
    updates: data.updates
      ? data.updates.map((update: any) => ({
          ...update,
          timestamp: new Date(update.timestamp),
        }))
      : [],
  } as Incident;
}

/**
 * gets a specified incident update by id
 *
 * @param id - the id of the incident update to retrieve
 * @returns the specified incident update as an IncidentUpdate
 */
export async function getUpdate(id: string): Promise<IncidentUpdate> {
  const response = await fetch(`${baseURL}/api/v1/updates/${id}`);
  if (!response.ok) {
    const data = await response.text();
    throw new Error(`response ${response.status}: ${data}`);
  }
  const data = (await response.json()) as IncidentUpdate;
  return {
    ...data,
    timestamp: new Date(data.timestamp),
  } as IncidentUpdate;
}

/**
 * creates a new incident
 *
 * @param incident - the incident to create, in IncidentPatch format
 * @returns the id of the newly created incident
 */
export async function createIncident(incident: IncidentPatch): Promise<string> {
  const response = await fetch(`${baseURL}/api/v1/admin/incidents/create`, {
    method: "POST",
    body: JSON.stringify(incident),
  });
  const data = await response.text();
  if (!response.ok) {
    throw new Error(`response ${response.status}: ${data}`);
  }
  return data;
}

/**
 * edits a preexisting incident by id
 *
 * @param id - the id of the incident to edit
 * @param patch - the information to edit/patch, in IncidentPatch format
 */
export async function editIncident(id: string, patch: IncidentPatch) {
  const response = await fetch(`${baseURL}/api/v1/admin/incidents/${id}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
  const data = await response.text();
  if (!response.ok) {
    throw new Error(`response ${response.status}: ${data}`);
  }
}

/**
 * creates a new incident update
 *
 * @param update - the update to create, in IncidentUpdate format
 * @returns the id of the newly created update
 */
export async function createUpdate(
  incidentID: string,
  update: IncidentUpdate,
): Promise<string> {
  const response = await fetch(
    `${baseURL}/api/v1/admin/incidents/${incidentID}/update`,
    {
      method: "POST",
      body: JSON.stringify(update),
    },
  );
  const data = await response.text();
  if (!response.ok) {
    throw new Error(`response ${response.status}: ${data}`);
  }
  return data;
}

/**
 * edit a preexisting incident update
 *
 * @param updateID - id of the incident update to edit
 * @param text - the updated body text to use
 */
export async function editUpdate(updateID: string, text: string) {
  const response = await fetch(`${baseURL}/api/v1/admin/updates/${updateID}`, {
    method: "PATCH",
    body: text,
  });
  const data = await response.text();
  if (!response.ok) {
    throw new Error(`response ${response.status}: ${data}`);
  }
}
