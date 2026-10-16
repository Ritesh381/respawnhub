{{- define "respawnhub.fullname" -}}
{{- if contains .Chart.Name .Release.Name -}}
{{- .Release.Name | trunc 63 | trimSuffix "-" -}}
{{- else -}}
{{- printf "%s-%s" .Release.Name .Chart.Name | trunc 63 | trimSuffix "-" -}}
{{- end -}}
{{- end -}}

{{- define "respawnhub.labels" -}}
app.kubernetes.io/name: {{ .Chart.Name }}
app.kubernetes.io/instance: {{ .Release.Name }}
app.kubernetes.io/version: {{ .Values.image.tag | trunc 12 | quote }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
helm.sh/chart: {{ printf "%s-%s" .Chart.Name .Chart.Version }}
{{- end -}}

{{/* Selector labels for one component. Call with (dict "root" . "component" "backend"). */}}
{{- define "respawnhub.selector" -}}
app.kubernetes.io/name: {{ .root.Chart.Name }}
app.kubernetes.io/instance: {{ .root.Release.Name }}
app.kubernetes.io/component: {{ .component }}
{{- end -}}

{{- define "respawnhub.image" -}}
{{- printf "%s/respawnhub-%s:%s" .root.Values.image.registry .component .root.Values.image.tag -}}
{{- end -}}

{{- define "respawnhub.dbSecret" -}}
{{- .Values.postgres.existingSecret | default (printf "%s-db" (include "respawnhub.fullname" .)) -}}
{{- end -}}

{{/* Full label set for a component's objects. Call with (dict "root" . "component" "backend"). */}}
{{- define "respawnhub.componentLabels" -}}
{{ include "respawnhub.selector" . }}
app.kubernetes.io/version: {{ .root.Values.image.tag | trunc 12 | quote }}
app.kubernetes.io/managed-by: {{ .root.Release.Service }}
helm.sh/chart: {{ printf "%s-%s" .root.Chart.Name .root.Chart.Version }}
{{- end -}}
