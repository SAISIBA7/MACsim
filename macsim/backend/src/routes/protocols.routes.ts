import { FastifyPluginAsync } from 'fastify';
import { PROTOCOL_TYPES, DEFAULTS } from '../config/constants.js';

export const protocolRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/protocols', async (_request, reply) => {
    return reply.status(200).send({
      protocols: [
        {
          id: PROTOCOL_TYPES.PURE_ALOHA,
          name: 'Pure ALOHA',
          description:
            'Unsynchronized random access protocol. Stations transmit frames immediately upon arrival. Vulnerable interval is 2 * frame_time.',
          theoreticalFormula: 'S = G * e^(-2G)',
          maxEfficiency: 0.184,
          optimalOfferedLoad: 0.5,
          supportedParameters: ['stationCount', 'frameSizeBytes', 'dataRateBps', 'trafficIntensity'],
          defaults: {
            frameSizeBytes: DEFAULTS.FRAME_SIZE_BYTES,
            dataRateBps: DEFAULTS.BANDWIDTH_BPS,
          },
        },
        {
          id: PROTOCOL_TYPES.SLOTTED_ALOHA,
          name: 'Slotted ALOHA',
          description:
            'Time is divided into discrete slots equal to frame transmission time. Stations transmit only at slot boundaries. Vulnerable interval is 1 * frame_time.',
          theoreticalFormula: 'S = G * e^(-G)',
          maxEfficiency: 0.368,
          optimalOfferedLoad: 1.0,
          supportedParameters: ['stationCount', 'frameSizeBytes', 'dataRateBps', 'slotDurationMs', 'trafficIntensity'],
          defaults: {
            frameSizeBytes: DEFAULTS.FRAME_SIZE_BYTES,
            dataRateBps: DEFAULTS.BANDWIDTH_BPS,
            slotDurationMs: 1.2,
          },
        },
        {
          id: 'CSMA',
          name: 'CSMA (Carrier Sense Multiple Access)',
          description:
            'Stations sense the shared medium before transmitting. If idle, they transmit; if busy, they defer transmission according to persistence algorithm (1-persistent, non-persistent, p-persistent).',
          theoreticalFormula: 'S = (G * e^(-aG)) / (G * (1 + 2a) + e^(-aG))',
          maxEfficiency: 0.53,
          optimalOfferedLoad: 2.0,
          supportedParameters: ['stationCount', 'frameSizeBytes', 'dataRateBps', 'propagationDelayMs', 'trafficIntensity'],
          defaults: {
            frameSizeBytes: DEFAULTS.FRAME_SIZE_BYTES,
            dataRateBps: DEFAULTS.BANDWIDTH_BPS,
            propagationDelayMs: 0.005,
          },
        },
        {
          id: PROTOCOL_TYPES.CSMA_CD,
          name: 'CSMA/CD (Carrier Sense Multiple Access with Collision Detection)',
          description:
            'Stations sense before transmitting and continuously listen while transmitting. If collision occurs, transmission is immediately aborted with a jam signal, followed by Binary Exponential Backoff.',
          theoreticalFormula: 'S = 1 / (1 + 5a)',
          maxEfficiency: 0.85,
          optimalOfferedLoad: 5.0,
          supportedParameters: ['stationCount', 'frameSizeBytes', 'dataRateBps', 'propagationDelayMs', 'jamDurationMs', 'trafficIntensity'],
          defaults: {
            frameSizeBytes: DEFAULTS.FRAME_SIZE_BYTES,
            dataRateBps: DEFAULTS.BANDWIDTH_BPS,
            propagationDelayMs: 0.005,
          },
        },
      ],
      trafficModels: [
        { id: 'poisson', name: 'Poisson Process (Exponential Inter-Arrivals)' },
        { id: 'uniform', name: 'Uniform Distribution' },
        { id: 'constant', name: 'Constant Rate Periodic Traffic' },
        { id: 'burst', name: 'Bursty Traffic Generator' },
      ],
      globalDefaults: {
        stationCount: 5,
        frameSizeBytes: DEFAULTS.FRAME_SIZE_BYTES,
        dataRateBps: DEFAULTS.BANDWIDTH_BPS,
        durationMs: 1000,
        trafficModel: 'poisson',
        trafficIntensity: 0.5,
      },
      limits: {
        stationCount: { min: 1, max: 100 },
        durationMs: { min: 10, max: 60000 },
        dataRateBps: { min: 100000, max: 1000000000 },
        frameSizeBytes: { min: 64, max: 9000 },
      },
    });
  });
};

