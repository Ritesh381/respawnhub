# Troubleshooting runbook

Four failures I broke on purpose and then fixed. Each one has a manifest in this folder (except the Compose one) and a screenshot of the real output in `docs/screenshots/`.

The order I check things in, whatever the problem:

```bash
kubectl get pods -n respawnhub                # what state is it in?
kubectl describe pod <pod> -n respawnhub      # Events at the bottom say why
kubectl logs <pod> -n respawnhub --previous   # output of the last crashed run
kubectl get events -n respawnhub --sort-by=.lastTimestamp
```

## 1. Image tag that does not exist

```bash
kubectl apply -f troubleshooting/01-bad-image-tag.yaml
```

**Symptom:** the pod sits in `ErrImagePull`, then `ImagePullBackOff`, and never starts.

**Diagnosis:** `kubectl describe pod -l app=lab-bad-image -n respawnhub` shows `Failed to pull image ... v9.9.9: not found`.

**Cause:** the Deployment asks for `respawnhub-backend:v9.9.9`. CI only publishes tags that are commit SHAs, so that tag was never pushed.

**Fix:** use a tag that exists, the one in `helm/respawnhub/values.yaml`:

```bash
kubectl set image deployment/lab-bad-image backend=ghcr.io/ritesh381/respawnhub-backend:<sha> -n respawnhub
```

## 2. Service with no endpoints

```bash
kubectl apply -f troubleshooting/02-service-no-endpoints.yaml
```

**Symptom:** calls to `lab-backend-typo:8000` from inside the cluster fail with "connection refused", even though the backend pods are healthy.

**Diagnosis:**

```bash
kubectl get endpointslices -n respawnhub -l kubernetes.io/service-name=lab-backend-typo   # no endpoints
kubectl get pods -n respawnhub --show-labels | grep backend                               # component=backend
```

**Cause:** the Service selects `app.kubernetes.io/component: api`, but the backend pods are labelled `component: backend`. A Service only sends traffic to pods whose labels match its selector, so this one has nothing behind it.

**Fix:** correct the selector:

```bash
kubectl patch svc lab-backend-typo -n respawnhub --type merge \
  -p '{"spec":{"selector":{"app.kubernetes.io/name":"respawnhub","app.kubernetes.io/component":"backend"}}}'
```

## 3. Wrong database password (CrashLoopBackOff)

```bash
TAG=$(grep -m1 'tag:' helm/respawnhub/values.yaml | cut -d'"' -f2)
sed "s/IMAGE_TAG/$TAG/" troubleshooting/03-wrong-db-password.yaml | kubectl apply -f -
```

**Symptom:** the pod starts, exits, and restarts with a growing delay: `CrashLoopBackOff`.

**Diagnosis:** `kubectl logs deploy/lab-crashloop -n respawnhub --previous` ends with `password authentication failed for user "respawnhub"`. The container runs migrations before starting the API, and that step cannot log in.

**Cause:** the pod reads `DB_PASSWORD` from `lab-wrong-db`, not from the real `respawnhub-db` Secret.

**Fix:** point it at the right Secret:

```bash
kubectl patch deployment lab-crashloop -n respawnhub --type json -p '[{"op":"replace","path":"/spec/template/spec/containers/0/env/1/valueFrom/secretKeyRef/name","value":"respawnhub-db"}]'
```

## 4. Backend exits on first `docker compose up`

**Symptom:** on a fresh machine `docker compose ps` shows the backend as `Exited (1)` and its logs say `connection failed ... Connection refused`. Running `docker compose up` again "fixes" it.

**Cause:** plain `depends_on` only waits for the Postgres container to start, not for Postgres to accept connections. On the first run Postgres spends a few seconds creating its data directory, the backend tries to migrate during that time, and the migration fails.

**Fix (already in `docker-compose.yml`):** give Postgres a `pg_isready` healthcheck and make the backend wait for `condition: service_healthy`. In Kubernetes the same job is done by the `wait-for-db` init container in the backend Deployment.

## Clean up

```bash
kubectl delete -f troubleshooting/01-bad-image-tag.yaml -f troubleshooting/02-service-no-endpoints.yaml
kubectl delete deployment/lab-crashloop secret/lab-wrong-db -n respawnhub
```

These lab objects are created by hand, not through Argo CD, so Argo CD leaves them alone. Changing an object that Argo CD does manage (for example scaling the real backend by hand) gets reverted within a minute, because the cluster is put back to what Git says.
