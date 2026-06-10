from django.urls import path

from .views import JamActionsView, JamDetailView, JamListCreateView, LockEditingView, UnlockEditingView, api_root

app_name = "jams"

urlpatterns = [
    path("", api_root, name="api-root"),
    path("jams/", JamListCreateView.as_view(), name="jam-list"),
    path("jams/<int:pk>/", JamDetailView.as_view(), name="jam-detail"),
    path("jams/<int:jam_id>/actions/", JamActionsView.as_view(), name="jam-actions"),
    path("jams/<int:jam_id>/lock-editing/", LockEditingView.as_view(), name="jam-lock-editing"),
    path("jams/<int:jam_id>/unlock-editing/", UnlockEditingView.as_view(), name="jam-unlock-editing"),
]
