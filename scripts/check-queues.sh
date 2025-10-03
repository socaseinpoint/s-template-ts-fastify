#!/bin/bash

# =============================================================================
# Queue Monitoring Script
# =============================================================================
# Check BullMQ queue status in Redis
#
# Usage:
#   ./scripts/check-queues.sh redis://localhost:6379
# =============================================================================

REDIS_URL=${1:-redis://localhost:6379}

echo "📊 Queue Status ($(date))"
echo "================================"

# Waiting jobs
echo "Waiting Jobs:"
echo "  api-calls:  $(redis-cli -u $REDIS_URL LLEN 'bull:api-calls:wait' 2>/dev/null || echo '?')"
echo "  ffmpeg:     $(redis-cli -u $REDIS_URL LLEN 'bull:ffmpeg:wait' 2>/dev/null || echo '?')"
echo "  s3-upload:  $(redis-cli -u $REDIS_URL LLEN 'bull:s3-upload:wait' 2>/dev/null || echo '?')"
echo ""

# Active jobs
echo "Active Jobs (currently processing):"
echo "  api-calls:  $(redis-cli -u $REDIS_URL LLEN 'bull:api-calls:active' 2>/dev/null || echo '?')"
echo "  ffmpeg:     $(redis-cli -u $REDIS_URL LLEN 'bull:ffmpeg:active' 2>/dev/null || echo '?')"
echo "  s3-upload:  $(redis-cli -u $REDIS_URL LLEN 'bull:s3-upload:active' 2>/dev/null || echo '?')"
echo ""

# Failed jobs
echo "Failed Jobs:"
echo "  api-calls:  $(redis-cli -u $REDIS_URL LLEN 'bull:api-calls:failed' 2>/dev/null || echo '?')"
echo "  ffmpeg:     $(redis-cli -u $REDIS_URL LLEN 'bull:ffmpeg:failed' 2>/dev/null || echo '?')"
echo "  s3-upload:  $(redis-cli -u $REDIS_URL LLEN 'bull:s3-upload:failed' 2>/dev/null || echo '?')"
echo ""

# Recommendations
API_WAIT=$(redis-cli -u $REDIS_URL LLEN 'bull:api-calls:wait' 2>/dev/null || echo '0')
FFMPEG_WAIT=$(redis-cli -u $REDIS_URL LLEN 'bull:ffmpeg:wait' 2>/dev/null || echo '0')

echo "Recommendations:"
if [ $API_WAIT -gt 100 ]; then
  echo "  ⚠️  api-calls queue HIGH ($API_WAIT jobs) - Consider scaling I/O workers"
elif [ $API_WAIT -gt 50 ]; then
  echo "  ⚡ api-calls queue elevated ($API_WAIT jobs) - Monitor closely"
else
  echo "  ✅ api-calls queue healthy ($API_WAIT jobs)"
fi

if [ $FFMPEG_WAIT -gt 10 ]; then
  echo "  ⚠️  ffmpeg queue HIGH ($FFMPEG_WAIT jobs) - Consider scaling FFmpeg workers"
elif [ $FFMPEG_WAIT -gt 5 ]; then
  echo "  ⚡ ffmpeg queue elevated ($FFMPEG_WAIT jobs) - Monitor closely"
else
  echo "  ✅ ffmpeg queue healthy ($FFMPEG_WAIT jobs)"
fi

echo "================================"

