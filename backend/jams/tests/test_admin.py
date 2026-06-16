import pytest
from django.contrib import admin
from django.contrib.auth import get_user_model
from django.urls import reverse
from django.utils.html import escape

from jams.admin import pretty_json
from jams.models import Jam, JamClientSession, JamEvent, JamSnapshot, JamTransaction

pytestmark = pytest.mark.django_db


def create_event_log():
    jam = Jam.objects.create(name="Jam admin", jam_id="jam_admin")
    transaction = JamTransaction.objects.create(
        jam=jam,
        transaction_id="transaction_admin",
        client_id="client_admin",
        client_sequence_number=1,
        server_sequence_number_start=1,
        server_sequence_number_end=1,
        schema_version=1,
        payload={"source": "admin-test"},
    )
    JamEvent.objects.create(
        jam=jam,
        transaction=transaction,
        event_id="event_admin",
        type="jam_created",
        payload={"jamId": "jam_admin", "name": "Jam admin"},
        schema_version=1,
        client_id="client_admin",
        client_sequence_number=1,
        server_sequence_number=1,
    )
    return jam


def login_superuser(client):
    user = get_user_model().objects.create_superuser(
        username="admin",
        email="admin@example.com",
        password="admin-password-for-test",
    )
    assert client.login(username="admin", password="admin-password-for-test")
    return user


def test_admin_index_loads_for_superuser(client):
    login_superuser(client)

    response = client.get(reverse("admin:index"))

    assert response.status_code == 200


def test_main_models_are_registered_in_admin():
    for model in (Jam, JamTransaction, JamEvent, JamSnapshot, JamClientSession):
        assert model in admin.site._registry


def test_jam_changelist_loads_for_superuser(client):
    create_event_log()
    login_superuser(client)

    response = client.get(reverse("admin:jams_jam_changelist"))

    assert response.status_code == 200
    assert b"jam_admin" in response.content


def test_jam_event_changelist_loads_for_superuser(client):
    create_event_log()
    login_superuser(client)

    response = client.get(reverse("admin:jams_jamevent_changelist"))

    assert response.status_code == 200
    assert b"jam_created" in response.content


def test_pretty_json_handles_dict_list_json_string_and_raw_string():
    dict_html = str(pretty_json({"name": "Élodie"}))
    list_html = str(pretty_json([{"round": 1}]))
    json_string_html = str(pretty_json('{"nested": [1, 2]}'))
    raw_string_html = str(pretty_json("not-json <raw>"))

    assert "<pre" in dict_html
    assert escape('"name": "Élodie"') in dict_html
    assert escape('"round": 1') in list_html
    assert escape('"nested": [') in json_string_html
    assert escape("not-json <raw>") in raw_string_html
