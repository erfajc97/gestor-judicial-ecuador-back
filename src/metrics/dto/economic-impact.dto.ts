import { IsNumber, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export class EconomicImpactDefaultsDto {
  annualFailedHearings: number;
  averageCostPerHearing: number;
  reductionScenarios: {
    veryConservative: number;
    mediumConservative: number;
    moderatelyConservative: number;
  };
}

export class CalculateEconomicImpactDto {
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  annualFailedHearings!: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  averageCostPerHearing!: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  reductionPercentage!: number;
}

export class EconomicImpactResultDto {
  reductionPercentage: number;
  avoidedCancellations: number;
  estimatedAnnualSavings: number;
  inputs: {
    annualFailedHearings: number;
    averageCostPerHearing: number;
  };
  timestamp: string;
}
