import { validate } from 'class-validator';
import { CreateExperimentDto } from './create-experiment.dto';
import {
  ExperimentScenario,
  NotificationChannel,
} from '../../../generated/prisma/enums';

describe('CreateExperimentDto', () => {
  it('should validate a valid DTO', async () => {
    const dto = new CreateExperimentDto();
    dto.name = 'Test Experiment';
    dto.scenario = ExperimentScenario.LATENCY;
    dto.channelTarget = NotificationChannel.EMAIL;
    dto.totalMessages = 100;
    dto.concurrency = 5;

    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });

  it('should fail validation when name is missing', async () => {
    const dto = new CreateExperimentDto();
    dto.scenario = ExperimentScenario.LATENCY;
    dto.channelTarget = NotificationChannel.EMAIL;
    dto.totalMessages = 100;
    dto.concurrency = 5;

    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].property).toBe('name');
  });

  it('should fail validation when totalMessages is too high', async () => {
    const dto = new CreateExperimentDto();
    dto.name = 'Test';
    dto.scenario = ExperimentScenario.LATENCY;
    dto.channelTarget = NotificationChannel.EMAIL;
    dto.totalMessages = 20000; // Exceeds max
    dto.concurrency = 5;

    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('should fail validation when concurrency is too high', async () => {
    const dto = new CreateExperimentDto();
    dto.name = 'Test';
    dto.scenario = ExperimentScenario.LATENCY;
    dto.channelTarget = NotificationChannel.EMAIL;
    dto.totalMessages = 100;
    dto.concurrency = 200; // Exceeds max

    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });
});
