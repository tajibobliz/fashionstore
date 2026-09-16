import { IsInt, IsPositive } from 'class-validator';
export class AssignBranchDto {
  @IsInt() @IsPositive() idSucursal: number;
}
