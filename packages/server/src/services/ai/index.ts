/**
 * AI services factory.
 *
 * Returns the AiServices bundle — mock implementations by default, real
 * implementations when FEATURE_REAL_AI=true and API keys are present.
 *
 * Callers always depend on the AiServices interface, never on a specific
 * implementation. Swapping ElevenLabs for Resemble.ai, or GPT-4 for Claude,
 * is a change inside this file only.
 */

import { env } from '../../config/env';
import { logger } from '../../config/logger';
import {
  MockVoiceoverService,
  MockScriptGenerationService,
  MockImageEnhancementService,
  MockVideoCompositionService,
} from './mock';
import type { AiServices } from './interfaces';

export type { AiServices } from './interfaces';

function createAiServices(): AiServices {
  if (env.features.realAi) {
    // Guard against misconfigured real-AI mode at startup rather than at
    // the first API call — makes environment problems immediately visible.
    if (!env.ai.openaiApiKey) {
      throw new Error('FEATURE_REAL_AI=true but OPENAI_API_KEY is not set');
    }
    if (!env.ai.elevenLabsApiKey) {
      throw new Error('FEATURE_REAL_AI=true but ELEVENLABS_API_KEY is not set');
    }

    // Real implementations would be instantiated here.
    // Keeping this throw explicit signals to the next engineer exactly
    // what needs to be built to enable real-AI mode.
    throw new Error(
      'Real AI service implementations are not yet wired. ' +
      'Implement services/ai/real.ts and return it here.'
    );
  }

  logger.info('AI services: running in mock mode (FEATURE_REAL_AI=false)');

  return {
    voiceover: new MockVoiceoverService(),
    scriptGeneration: new MockScriptGenerationService(),
    imageEnhancement: new MockImageEnhancementService(),
    videoComposition: new MockVideoCompositionService(),
  };
}

/** Singleton — initialised once at startup */
export const aiServices: AiServices = createAiServices();
