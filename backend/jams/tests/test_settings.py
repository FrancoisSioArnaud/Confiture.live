from pathlib import Path

from django.conf import settings


def test_static_files_are_configured_for_django_admin_collectstatic():
    assert settings.STATIC_URL == "/static/"
    assert settings.STATIC_ROOT == Path(settings.BASE_DIR) / "staticfiles"
