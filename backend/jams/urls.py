from django.urls import path
from . import views
urlpatterns = [path('jams/', views.jams_collection), path('jams/<str:jam_id>/', views.jam_detail), path('jams/<str:jam_id>/transactions/', views.jam_transactions), path('jams/<str:jam_id>/snapshots/', views.jam_snapshots), path('jams/<str:jam_id>/lease/', views.jam_lease)]
