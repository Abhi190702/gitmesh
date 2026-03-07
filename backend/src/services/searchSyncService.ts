import { LoggerBase } from '@gitmesh/logging'
import { SearchSyncWorkerEmitter } from '@gitmesh/sqs'
import { SyncMode } from '@gitmesh/types'
import { getSearchSyncWorkerEmitter } from '@/serverless/utils/serviceSQS'
import { IServiceOptions } from './IServiceOptions'

/**
 * SearchSyncService - OpenSearch has been removed.
 * All sync operations are now no-ops. Data is queried directly from the database.
 * This class is kept for API compatibility so callers don't need to be updated.
 */
export default class SearchSyncService extends LoggerBase {
  options: IServiceOptions
  mode: SyncMode

  constructor(options: IServiceOptions, mode: SyncMode = SyncMode.USE_FEATURE_FLAG) {
    super(options.log)
    this.options = options
    this.mode = mode
  }

  // All sync trigger methods are no-ops since OpenSearch is removed
  async triggerMemberSync(_tenantId: string, _memberId: string) {}
  async triggerTenantMembersSync(_tenantId: string) {}
  async triggerOrganizationMembersSync(_organizationId: string) {}
  async triggerRemoveMember(_tenantId: string, _memberId: string) {}
  async triggerMemberCleanup(_tenantId: string) {}
  async triggerActivitySync(_tenantId: string, _activityId: string) {}
  async triggerTenantActivitiesSync(_tenantId: string) {}
  async triggerOrganizationActivitiesSync(_organizationId: string) {}
  async triggerRemoveActivity(_tenantId: string, _activityId: string) {}
  async triggerActivityCleanup(_tenantId: string) {}
  async triggerOrganizationSync(_tenantId: string, _organizationId: string) {}
  async triggerTenantOrganizationSync(_tenantId: string) {}
  async triggerRemoveOrganization(_tenantId: string, _organizationId: string) {}
  async triggerOrganizationCleanup(_tenantId: string) {}
}
