from django.urls import path
from . import views

urlpatterns = [
    path('health/', views.health),
    path('jams/', views.jams_collection),
    path('jams/<str:jam_id>/', views.jam_detail),
    path('jams/<str:jam_id>/transactions/', views.jam_transactions),
    path('jams/<str:jam_id>/snapshots/', views.jam_snapshots),
    path('jams/<str:jam_id>/snapshot/latest/', views.latest_jam_snapshot),
    path('jams/<str:jam_id>/client-session/acquire/', views.client_session_acquire),
    path('jams/<str:jam_id>/client-session/heartbeat/', views.client_session_heartbeat),
    path('jams/<str:jam_id>/client-session/release/', views.client_session_release),
    path('jams/<str:jam_id>/client-session/takeover/', views.client_session_takeover),
    path('jams/<str:jam_id>/lease/', views.jam_lease),
]
