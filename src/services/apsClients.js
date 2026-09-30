import { DataManagementClient } from '@aps_sdk/data-management';
import { OssClient } from '@aps_sdk/oss';

/**
 * Shared, stateless APS SDK client singletons.
 *
 * The Data Management and OSS clients hold no per-user state — the access token
 * is passed per call — so a single instance is reused across the service layer.
 */
export const dataClient = new DataManagementClient();
export const ossClient = new OssClient();
