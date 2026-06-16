import json

from django.contrib import admin
from django.utils.html import format_html

from .models import Jam, JamClientSession, JamEvent, JamSnapshot, JamTransaction


def pretty_json(value):
    """Render JSONField or JSON-looking strings in a readable, escaped block."""
    parsed = value
    if isinstance(value, str):
        try:
            parsed = json.loads(value)
        except (TypeError, ValueError, json.JSONDecodeError):
            parsed = value

    try:
        content = json.dumps(parsed, indent=2, ensure_ascii=False)
    except TypeError:
        content = str(value)

    return format_html("<pre style='white-space: pre-wrap; margin: 0;'>{}</pre>", content)


class EventSourcingReadOnlyAdmin(admin.ModelAdmin):
    """Protect append-only event-sourcing records from accidental admin edits."""

    def has_add_permission(self, request):
        return False

    def has_delete_permission(self, request, obj=None):
        return False


@admin.register(Jam)
class JamAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "jam_id",
        "name",
        "status",
        "indicative_date",
        "link_reorder_strategy",
        "latest_server_sequence_number",
        "transactions_count",
        "events_count",
        "created_at",
        "updated_at",
    )
    search_fields = ("jam_id", "name")
    list_filter = ("status", "link_reorder_strategy", "created_at")
    readonly_fields = ("jam_id", "latest_server_sequence_number", "created_at", "updated_at", "pretty_metadata")
    ordering = ("-created_at",)

    def get_queryset(self, request):
        return super().get_queryset(request).prefetch_related("transactions", "events")

    @admin.display(description="Transactions")
    def transactions_count(self, obj):
        return obj.transactions.count()

    @admin.display(description="Events")
    def events_count(self, obj):
        return obj.events.count()

    @admin.display(description="Metadata")
    def pretty_metadata(self, obj):
        return pretty_json(obj.metadata)


@admin.register(JamTransaction)
class JamTransactionAdmin(EventSourcingReadOnlyAdmin):
    list_display = (
        "id",
        "transaction_id",
        "jam",
        "client_id",
        "client_sequence_number",
        "server_sequence_number_start",
        "server_sequence_number_end",
        "schema_version",
        "reverted",
        "created_at",
    )
    search_fields = ("transaction_id", "jam__jam_id", "jam__name", "client_id")
    list_filter = ("schema_version", "created_at", "reverted")
    readonly_fields = (
        "jam",
        "transaction_id",
        "client_id",
        "client_sequence_number",
        "server_sequence_number_start",
        "server_sequence_number_end",
        "schema_version",
        "payload",
        "pretty_payload",
        "reverted",
        "created_at",
    )

    @admin.display(description="Payload")
    def pretty_payload(self, obj):
        return pretty_json(obj.payload)


@admin.register(JamEvent)
class JamEventAdmin(EventSourcingReadOnlyAdmin):
    list_display = (
        "id",
        "event_id",
        "jam",
        "type",
        "server_sequence_number",
        "client_id",
        "client_sequence_number",
        "schema_version",
        "created_at",
    )
    search_fields = ("event_id", "type", "jam__jam_id", "jam__name", "client_id")
    list_filter = ("type", "schema_version", "created_at")
    readonly_fields = (
        "jam",
        "transaction",
        "event_id",
        "type",
        "server_sequence_number",
        "client_id",
        "client_sequence_number",
        "schema_version",
        "payload",
        "pretty_payload",
        "created_at",
    )

    @admin.display(description="Payload")
    def pretty_payload(self, obj):
        return pretty_json(obj.payload)


@admin.register(JamSnapshot)
class JamSnapshotAdmin(EventSourcingReadOnlyAdmin):
    list_display = ("id", "snapshot_id", "jam", "client_id", "last_server_sequence_number", "schema_version", "created_at")
    search_fields = ("snapshot_id", "jam__jam_id", "jam__name", "client_id")
    list_filter = ("schema_version", "created_at")
    readonly_fields = (
        "snapshot_id",
        "jam",
        "client_id",
        "last_server_sequence_number",
        "schema_version",
        "payload",
        "pretty_payload",
        "created_at",
    )

    @admin.display(description="Payload")
    def pretty_payload(self, obj):
        return pretty_json(obj.payload)


@admin.register(JamClientSession)
class JamClientSessionAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "session_id",
        "jam",
        "client_id",
        "status",
        "lease_token_short",
        "acquired_at",
        "last_heartbeat_at",
        "lease_expires_at",
    )
    search_fields = ("session_id", "client_id", "jam__jam_id", "jam__name")
    list_filter = ("status", "acquired_at", "lease_expires_at")
    readonly_fields = (
        "session_id",
        "lease_token",
        "jam",
        "client_id",
        "acquired_at",
        "last_heartbeat_at",
        "lease_expires_at",
        "metadata",
        "pretty_metadata",
    )

    @admin.display(description="Lease token")
    def lease_token_short(self, obj):
        if not obj.lease_token:
            return ""
        return f"{obj.lease_token[:12]}…"

    @admin.display(description="Metadata")
    def pretty_metadata(self, obj):
        return pretty_json(obj.metadata)
