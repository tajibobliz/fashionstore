import { useQuery } from '@tanstack/react-query'
import { usersApi } from '../api/users.api'; import { branchesApi } from '../api/branches.api'; import { warehousesApi } from '../api/warehouses.api'; import { inventoryApi } from '../api/inventory.api'; import { reportsApi } from '../api/reports.api'; import { queryKeys } from '../api/queryKeys'; import type { ReportFilters } from '../types/report'
export const useUsers = () => useQuery({ queryKey: queryKeys.users.all, queryFn: usersApi.list })
export const useBranches = () => useQuery({ queryKey: queryKeys.branches.all, queryFn: branchesApi.branches.list })
export const useWarehouses = (idSucursal?: number) => useQuery({ queryKey: idSucursal ? queryKeys.warehouses.byBranch(idSucursal) : queryKeys.warehouses.all, queryFn: () => idSucursal ? warehousesApi.byBranch(idSucursal) : warehousesApi.list() })
export const useInventory = () => useQuery({ queryKey: queryKeys.inventory.all, queryFn: inventoryApi.list })
export const useDashboardReport = (filters?: ReportFilters) => useQuery({ queryKey: queryKeys.reports.dashboard(filters), queryFn: () => reportsApi.dashboard(filters) })
