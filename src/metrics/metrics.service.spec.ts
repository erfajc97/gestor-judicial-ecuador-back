import { Test, TestingModule } from '@nestjs/testing';
import { MetricsService } from './metrics.service';
import { PrismaService } from '../prisma/prisma.service';

type PercentileResult = {
  p50: number;
  p95: number;
  p99: number;
  avg: number;
} | null;

describe('MetricsService', () => {
  let service: MetricsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MetricsService,
        {
          provide: PrismaService,
          useValue: {
            notificationMetricEvent: {
              findMany: jest.fn(),
              count: jest.fn(),
            },
            experimentSeriesPoint: {
              findMany: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    service = module.get<MetricsService>(MetricsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('calculatePercentiles', () => {
    it('should calculate percentiles correctly', () => {
      const values = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      const result = (service as any).calculatePercentiles(
        values,
      ) as PercentileResult;

      expect(result).toBeDefined();
      expect(result).not.toBeNull();
      if (result) {
        expect(result.p50).toBe(50);
        expect(result.p95).toBe(95);
        expect(result.p99).toBe(99);
        expect(result.avg).toBe(55);
      }
    });

    it('should return null for empty array', () => {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      const result = (service as any).calculatePercentiles(
        [],
      ) as PercentileResult;
      expect(result).toBeNull();
    });

    it('should handle single value', () => {
      const values = [42];
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      const result = (service as any).calculatePercentiles(
        values,
      ) as PercentileResult;

      expect(result).toBeDefined();
      expect(result).not.toBeNull();
      if (result) {
        expect(result.p50).toBe(42);
        expect(result.p95).toBe(42);
        expect(result.p99).toBe(42);
        expect(result.avg).toBe(42);
      }
    });
  });
});
