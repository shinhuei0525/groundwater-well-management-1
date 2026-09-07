/**
 * Trigger the groundwater public-site sync workflow in GitHub Actions.
 *
 * Required Apps Script properties:
 * - GITHUB_TOKEN: GitHub fine-grained token with repository dispatch permission.
 * - GITHUB_OWNER: GitHub repository owner, for example "wushinhuei".
 * - GITHUB_REPO: GitHub repository name, for example "groundwater-well-management".
 *
 * Optional Apps Script properties:
 * - GITHUB_EVENT_TYPE: Defaults to "groundwater-sync".
 * - GROUNDWATER_ROOT_FOLDER_ID: Drive project root folder id.
 * - REGISTRY_FOLDER_ID: Drive folder id that contains the source registry Excel files.
 * - WELL_INDEX_FOLDER_ID: Drive system index folder id.
 * - PUMPING_INDEX_FOLDER_ID: Drive pumping index folder id.
 * - WATER_RIGHT_FOLDER_ID: Drive active water-right certificate folder id.
 */

const DEFAULT_EVENT_TYPE = 'groundwater-sync';
const DEFAULT_TIMEZONE = 'Asia/Taipei';
const DEFAULT_TRIGGER_HOUR = 6;
const DEFAULT_TRIGGER_WEEKDAY = ScriptApp.WeekDay.MONDAY;

const DEFAULT_DRIVE_IDS = {
  groundwaterRootFolderId: '1TLw8JdrVw_OagddkzZz96effiJ51q3F5',
  registryFolderId: '',
  wellIndexFolderId: '',
  pumpingIndexFolderId: '',
  waterRightFolderId: '',
};

function triggerGroundwaterSync() {
  const properties = PropertiesService.getScriptProperties();
  const token = requiredProperty_(properties, 'GITHUB_TOKEN');
  const owner = requiredProperty_(properties, 'GITHUB_OWNER');
  const repo = requiredProperty_(properties, 'GITHUB_REPO');
  const eventType = properties.getProperty('GITHUB_EVENT_TYPE') || DEFAULT_EVENT_TYPE;

  const payload = {
    source: 'google-apps-script',
    triggeredAt: new Date().toISOString(),
    timezone: DEFAULT_TIMEZONE,
    schedule: 'weekly',
    syncScope: 'all',
    rules: {
      wellRegistry: 'groundwater-well-sync',
      pumpingHistory: 'groundwater-pumping-sync',
      excelPolicy: 'use-newest-registry-date-and-skip-unchanged-workbook',
      certificatePolicy: 'drive-files-valid-unless-unmatched-or-unparseable',
      photoPolicy: 'extract-and-hash-embedded-excel-images',
      expirationPolicy: 'warn-expired-and-expiring-water-rights',
    },
    drive: {
      groundwaterRootFolderId:
        properties.getProperty('GROUNDWATER_ROOT_FOLDER_ID') ||
        DEFAULT_DRIVE_IDS.groundwaterRootFolderId,
      registryFolderId:
        properties.getProperty('REGISTRY_FOLDER_ID') ||
        DEFAULT_DRIVE_IDS.registryFolderId,
      wellIndexFolderId:
        properties.getProperty('WELL_INDEX_FOLDER_ID') ||
        DEFAULT_DRIVE_IDS.wellIndexFolderId,
      pumpingIndexFolderId:
        properties.getProperty('PUMPING_INDEX_FOLDER_ID') ||
        DEFAULT_DRIVE_IDS.pumpingIndexFolderId,
      waterRightFolderId:
        properties.getProperty('WATER_RIGHT_FOLDER_ID') ||
        DEFAULT_DRIVE_IDS.waterRightFolderId,
    },
  };

  const url =
    'https://api.github.com/repos/' +
    encodeURIComponent(owner) +
    '/' +
    encodeURIComponent(repo) +
    '/dispatches';

  const response = UrlFetchApp.fetch(url, {
    method: 'post',
    contentType: 'application/json',
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: 'Bearer ' + token,
      'X-GitHub-Api-Version': '2022-11-28',
    },
    muteHttpExceptions: true,
    payload: JSON.stringify({
      event_type: eventType,
      client_payload: payload,
    }),
  });

  const status = response.getResponseCode();
  if (status < 200 || status >= 300) {
    throw new Error(
      'GitHub Actions trigger failed: HTTP ' +
        status +
        ' ' +
        response.getContentText()
    );
  }

  console.log('Groundwater sync workflow dispatched: ' + eventType);
}

function installWeeklyTrigger() {
  deleteGroundwaterSyncTriggers();
  ScriptApp.newTrigger('triggerGroundwaterSync')
    .timeBased()
    .onWeekDay(DEFAULT_TRIGGER_WEEKDAY)
    .atHour(DEFAULT_TRIGGER_HOUR)
    .nearMinute(0)
    .inTimezone(DEFAULT_TIMEZONE)
    .create();
}

function deleteGroundwaterSyncTriggers() {
  ScriptApp.getProjectTriggers()
    .filter((trigger) => trigger.getHandlerFunction() === 'triggerGroundwaterSync')
    .forEach((trigger) => ScriptApp.deleteTrigger(trigger));
}

function testTriggerGroundwaterSync() {
  triggerGroundwaterSync();
}

function requiredProperty_(properties, name) {
  const value = properties.getProperty(name);
  if (!value) {
    throw new Error('Missing required Apps Script property: ' + name);
  }
  return value;
}
