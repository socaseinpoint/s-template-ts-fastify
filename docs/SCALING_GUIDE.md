# Scaling Guide

How to scale your service based on load.

---

## 🎯 Scaling Decision Matrix

| Metric | Value | Action |
|--------|-------|--------|
| **API CPU** | > 70% | Scale API instances |
| **API latency** | > 500ms | Scale API instances |
| **Queue: api-calls** | > 100 waiting | Scale I/O workers |
| **Queue: ffmpeg** | > 10 waiting | Scale FFmpeg workers |
| **Worker CPU** | > 80% | Scale workers |
| **Failed jobs** | Increasing | Investigate, then scale |

---

## ⚡ Quick Scaling Commands

### Using Helper Script

```bash
# Minimal (save costs)
./scripts/scale.sh minimal production

# Normal load
./scripts/scale.sh normal production

# High load (traffic spike)
./scripts/scale.sh high-load production

# Emergency (viral moment!)
./scripts/scale.sh emergency production
```

### Manual Scaling

```bash
# Scale API
docker service scale myapp-production_api=5

# Scale I/O workers
docker service scale myapp-production_worker-io=10

# Scale FFmpeg workers
docker service scale myapp-production_worker-ffmpeg=3
```

---

## 📈 Scaling Presets

### Minimal (Cost-Saving)
**Traffic:** < 100 videos/day

```
API: 1 instance
I/O Workers: 2 instances
FFmpeg Workers: 1 instance

Cost: ~$30/month
```

### Normal (Standard Load)
**Traffic:** 100-1000 videos/day

```
API: 2 instances
I/O Workers: 5 instances
FFmpeg Workers: 2 instances

Cost: ~$100/month
```

### High Load (Traffic Spike)
**Traffic:** 1000-5000 videos/day

```
API: 5 instances
I/O Workers: 15 instances
FFmpeg Workers: 4 instances

Cost: ~$300/month
```

### Emergency (Viral Moment)
**Traffic:** > 10,000 videos/day

```
API: 10 instances
I/O Workers: 30 instances
FFmpeg Workers: 8 instances

Cost: ~$800/month
```

---

## 🔍 Monitoring Queue Status

```bash
# Check queue length
./scripts/check-queues.sh $REDIS_URL

# Output:
# Waiting Jobs:
#   api-calls:  150  ⚠️  HIGH
#   ffmpeg:     12   ⚠️  HIGH
#   s3-upload:  5    ✅  OK
#
# Recommendations:
#   ⚠️  Scale I/O workers (queue: 150)
#   ⚠️  Scale FFmpeg workers (queue: 12)
```

---

## 🤖 Auto-Scaling Setup

### Option 1: Docker Swarm + Script (Simple)

```bash
# Cron on manager node
# /etc/cron.d/autoscale

*/5 * * * * /opt/myapp/scripts/autoscale.sh
```

```bash
# scripts/autoscale.sh
#!/bin/bash

QUEUE_LENGTH=$(redis-cli -u $REDIS_URL LLEN "bull:api-calls:wait")

if [ $QUEUE_LENGTH -gt 200 ]; then
  # High load
  ./scripts/scale.sh high-load production
elif [ $QUEUE_LENGTH -gt 100 ]; then
  # Normal load
  ./scripts/scale.sh normal production
elif [ $QUEUE_LENGTH -lt 20 ]; then
  # Low load - save costs
  ./scripts/scale.sh minimal production
fi
```

### Option 2: Kubernetes HPA (Advanced)

```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: worker-io-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: worker-io
  minReplicas: 3
  maxReplicas: 20
  metrics:
    # Scale based on CPU
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 70
    
    # Scale based on queue length (custom metric)
    - type: External
      external:
        metric:
          name: bullmq_queue_waiting
          selector:
            matchLabels:
              queue: api-calls
        target:
          type: AverageValue
          averageValue: "10"
```

### Option 3: Cloud Provider Auto-Scaling

```bash
# AWS ECS Auto Scaling
aws application-autoscaling register-scalable-target \
  --service-namespace ecs \
  --resource-id service/myapp-cluster/worker-io \
  --scalable-dimension ecs:service:DesiredCount \
  --min-capacity 3 \
  --max-capacity 20

aws application-autoscaling put-scaling-policy \
  --service-namespace ecs \
  --resource-id service/myapp-cluster/worker-io \
  --scalable-dimension ecs:service:DesiredCount \
  --policy-name queue-based-scaling \
  --policy-type TargetTrackingScaling \
  --target-tracking-scaling-policy-configuration \
    TargetValue=10.0,PredefinedMetricSpecification={PredefinedMetricType=ALBRequestCountPerTarget}
```

---

## 📊 Scaling Strategy by Component

### API Scaling (Stateless ✅)

**Scale based on:**
- HTTP request rate
- CPU usage
- Response latency

**How many?**
```
< 100 req/min   → 1-2 instances
100-1000 req/min → 2-5 instances
> 1000 req/min   → 5-10 instances
```

**Command:**
```bash
docker service scale myapp-production_api=5
```

---

### I/O Workers Scaling (Stateless ✅)

**Scale based on:**
- Queue length (api-calls queue)
- External API rate limits
- Cost optimization

**How many?**
```
< 50 jobs waiting   → 2-3 workers
50-200 jobs waiting → 5-10 workers
> 200 jobs waiting  → 15-30 workers
```

**Command:**
```bash
docker service scale myapp-production_worker-io=15
```

**Calculate:**
```
Average job time: 3 seconds
Concurrency per worker: 10
1 worker throughput: 200 jobs/min

For 500 jobs waiting:
500 / 200 = 2.5 minutes with 1 worker
500 / (200 × 5) = 30 seconds with 5 workers ✅
```

---

### FFmpeg Workers Scaling (CPU-Heavy 🔥)

**Scale based on:**
- Queue length (ffmpeg queue)
- CPU availability
- Video complexity

**How many?**
```
< 5 jobs waiting    → 1-2 workers
5-20 jobs waiting   → 3-4 workers
> 20 jobs waiting   → 5-8 workers MAX
```

**⚠️ Warning:** FFmpeg workers = expensive!
```
1 FFmpeg worker = 4 CPU cores = $40/month
Don't over-scale!
```

**Command:**
```bash
docker service scale myapp-production_worker-ffmpeg=3
```

---

## 💰 Cost Optimization

### Scale Down During Off-Hours

```bash
# Cron: Scale down at night (1am UTC)
0 1 * * * ./scripts/scale.sh minimal production

# Cron: Scale up in morning (8am UTC)
0 8 * * * ./scripts/scale.sh normal production
```

### Weekend vs Weekday

```bash
# Cron: Minimal on weekends
0 0 * * 6 ./scripts/scale.sh minimal production  # Saturday
0 0 * * 0 ./scripts/scale.sh minimal production  # Sunday

# Cron: Normal on weekdays
0 8 * * 1-5 ./scripts/scale.sh normal production
```

---

## 🚨 When to Scale Different Components

### Scale API when:
```
✅ HTTP 503 errors appearing
✅ Response time > 500ms
✅ CPU > 70%
✅ Memory > 80%
❌ Queue is long (scale workers instead!)
```

### Scale I/O Workers when:
```
✅ api-calls queue > 100
✅ Users waiting > 2 minutes
✅ External API rate limits reached
❌ CPU high (check FFmpeg instead!)
```

### Scale FFmpeg Workers when:
```
✅ ffmpeg queue > 10
✅ Video processing taking > 5 minutes
✅ All FFmpeg workers at 100% CPU
❌ If queue < 5 (don't waste money!)
```

---

## 🔄 Multi-Server Scaling

### Add New Worker Node to Swarm

```bash
# On new server
docker swarm join --token SWMTKN-... manager-ip:2377

# On manager
docker node ls  # See new node

# Label for I/O workers
docker node update --label-add worker-type=io node4

# Workers will auto-deploy to new node!
```

### Add GPU Node (Future)

```bash
# On GPU server
docker swarm join --token SWMTKN-... manager-ip:2377

# On manager
docker node update --label-add gpu=nvidia node5

# Uncomment GPU section in swarm.production.yml
# Redeploy:
docker stack deploy -c swarm.production.yml myapp-production
```

---

## 📈 Growth Timeline

### Month 1: MVP
```
1 server, MODE=all
Cost: $20/month
Capacity: 100 users/day
```

### Month 3: Growth
```
1 manager, 2 workers
API × 2, Workers × 5
Cost: $100/month
Capacity: 1000 users/day
```

### Month 6: Scale
```
1 manager, 4 workers
API × 3, I/O × 10, FFmpeg × 3
Cost: $300/month
Capacity: 5000 users/day
```

### Year 1: Enterprise
```
2 managers, 10 workers
API × 5, I/O × 20, FFmpeg × 5, GPU × 2
Cost: $1000/month
Capacity: 50,000 users/day
```

---

## 🎯 Практические советы:

### 1. Start Small, Scale When Needed

```bash
# Don't over-provision!
# Start: 1 API, 2 workers
# Scale when queue > 50
```

### 2. Monitor Before Scaling

```bash
# Check metrics FIRST
./scripts/check-queues.sh
docker stats

# Then decide to scale
```

### 3. Scale I/O Workers First

```
I/O workers = cheap ($10/month)
FFmpeg workers = expensive ($40/month)
GPU workers = very expensive ($100+/month)

Scale in order: I/O → FFmpeg → GPU
```

### 4. Scale Down to Save Money

```bash
# After traffic spike
./scripts/scale.sh normal production

# Weekend/night
./scripts/scale.sh minimal production
```

---

## 📚 Commands Cheat Sheet

```bash
# Check status
docker service ls
./scripts/check-queues.sh $REDIS_URL

# Quick scale
./scripts/scale.sh [minimal|normal|high-load|emergency] production

# Manual scale
docker service scale myapp-production_worker-io=10

# Add server to swarm
docker swarm join-token worker  # Get token
# On new server: docker swarm join --token ...

# View logs
docker service logs -f myapp-production_worker-ffmpeg

# Check resources
docker stats
```

---

**TL;DR:**
- Monitor queue length
- Use `./scripts/scale.sh` for presets
- Scale I/O workers easily (cheap)
- Scale FFmpeg carefully (expensive)
- Auto-scale with cron or K8s HPA 🚀
