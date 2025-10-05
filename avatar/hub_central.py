import os
import pandas as pd
import numpy as np
import dash
from dash import Dash, html, dcc, Input, Output, State, callback_context, ALL
import dash_bootstrap_components as dbc
import plotly.express as px
import plotly.graph_objects as go
from plotly.subplots import make_subplots
from datetime import datetime, timedelta, date
import warnings
from scipy import stats
from scipy.interpolate import griddata
import plotly.figure_factory as ff
from sklearn.preprocessing import StandardScaler
from sklearn.decomposition import PCA


warnings.filterwarnings('ignore')

# =============================================================================
# CONFIGURACIÓN GLOBAL
# =============================================================================
PORT = int(os.environ.get("PORT", 7860))

# Coordenadas precisas de Ecuador
ECUADOR_CENTER = {'lat': -1.8312, 'lon': -78.1834}
ECUADOR_BOUNDS = {
    'north': 1.5, 'south': -5.0,
    'east': -75.0, 'west': -81.5
}

# Límites estrictos para filtrar oceano
ECUADOR_LAND_BOUNDS = {
    'north': 1.4, 'south': -4.9,
    'east': -75.2, 'west': -81.2
}

DATABASES = {
    "GLDAS": os.environ.get("GLDAS_CSV", "ecuador_gldas_enriquecido_solo_tierra (1).csv"),
    "GPM": os.environ.get("GPM_CSV", "ecuador_gpm_clean_20250918_214234.csv"),
    "FIRE": os.environ.get("FIRE_CSV", "ecuador_fire_complete_20250920_2338.csv")
}

# Paleta de colores
COLORS = {
    'primary': '#00D4FF',
    'secondary': '#7C3AED',
    'success': '#00C896',
    'warning': '#FFB800',
    'danger': '#FF5757',
    'info': '#4F46E5',
    'bg_primary': '#0A0E1A',
    'bg_secondary': '#1A1F2E',
    'bg_card': '#1E2532',
    'text_primary': '#FFFFFF',
    'text_secondary': '#A1A9B8',
    'accent_1': '#FF6B6B',
    'accent_2': '#4ECDC4',
    'accent_3': '#45B7D1',
    'accent_4': '#96CEB4'
}

# Diccionario de provincias válidas de Ecuador
ECUADOR_PROVINCES = {
    'AZUAY': 'Azuay',
    'BOLIVAR': 'Bolívar',
    'CANAR': 'Cañar',
    'CARCHI': 'Carchi',
    'CHIMBORAZO': 'Chimborazo',
    'COTOPAXI': 'Cotopaxi',
    'EL ORO': 'El Oro',
    'ESMERALDAS': 'Esmeraldas',
    'GALAPAGOS': 'Galápagos',
    'GUAYAS': 'Guayas',
    'IMBABURA': 'Imbabura',
    'LOJA': 'Loja',
    'LOS RIOS': 'Los Ríos',
    'MANABI': 'Manabí',
    'MORONA SANTIAGO': 'Morona Santiago',
    'NAPO': 'Napo',
    'ORELLANA': 'Orellana',
    'PASTAZA': 'Pastaza',
    'PICHINCHA': 'Pichincha',
    'SANTA ELENA': 'Santa Elena',
    'SANTO DOMINGO DE LOS TSACHILAS': 'Santo Domingo de los Tsáchilas',
    'SUCUMBIOS': 'Sucumbíos',
    'TUNGURAHUA': 'Tungurahua',
    'ZAMORA CHINCHIPE': 'Zamora Chinchipe',
    'ZAMORA-CHINCHIPE': 'Zamora Chinchipe'
}

# =============================================================================
# FUNCIONES DE LIMPIEZA Y VALIDACIÓN
# =============================================================================
def clean_province_names(df, column='provincia'):
    """Limpiar y estandarizar nombres de provincias"""
    if df is None or column not in df.columns:
        return df
    
    df = df.copy()
    
    # Normalizar texto
    df[column] = df[column].astype(str).str.upper().str.strip()
    
    # Reemplazar valores problemáticos
    df[column] = df[column].replace({
        'NAN': 'NO_IDENTIFICADO',
        'NONE': 'NO_IDENTIFICADO',
        'NULL': 'NO_IDENTIFICADO',
        '': 'NO_IDENTIFICADO',
        'NO ENCONTRADO': 'NO_IDENTIFICADO',
        'NO_ENCONTRADA': 'NO_IDENTIFICADO'
    })
    
    # Mapear a nombres correctos
    df[column] = df[column].map(ECUADOR_PROVINCES).fillna('NO_IDENTIFICADO')
    
    return df

def filter_ecuador_land_only(df):
    """Filtrar puntos que estén estrictamente en tierra ecuatoriana"""
    if df is None or not all(col in df.columns for col in ['lat', 'lon']):
        return df
    
    df = df.copy()
    
    # Convertir a numérico
    df['lat'] = pd.to_numeric(df['lat'], errors='coerce')
    df['lon'] = pd.to_numeric(df['lon'], errors='coerce')
    
    # Filtrar coordenadas válidas
    df = df.dropna(subset=['lat', 'lon'])
    
    # Aplicar límites estrictos de Ecuador continental
    mask = (
        (df['lat'] >= ECUADOR_LAND_BOUNDS['south']) &
        (df['lat'] <= ECUADOR_LAND_BOUNDS['north']) &
        (df['lon'] >= ECUADOR_LAND_BOUNDS['west']) &
        (df['lon'] <= ECUADOR_LAND_BOUNDS['east'])
    )
    
    df = df[mask]
    
    print(f"   Filtrado geográfico: {len(df):,} puntos válidos en tierra")
    
    return df

def remove_invalid_data(df):
    """Remover datos claramente inválidos"""
    if df is None:
        return df
    
    initial_count = len(df)
    df = df.copy()
    
    # Remover filas con provincia NO_IDENTIFICADO
    if 'provincia' in df.columns:
        df = df[df['provincia'] != 'NO_IDENTIFICADO']
    
    # Remover valores extremos obviamente incorrectos
    if 'frp' in df.columns:
        df = df[(df['frp'] >= 0) & (df['frp'] <= 10000)]
    
    if 'max_frp' in df.columns:
        df = df[(df['max_frp'] >= 0) & (df['max_frp'] <= 10000)]
    
    if 'precipitation' in df.columns:
        df = df[df['precipitation'] >= 0]
    
    print(f"   Limpieza: {initial_count:,} -> {len(df):,} registros ({initial_count-len(df):,} removidos)")
    
    return df

# =============================================================================
# FUNCIONES DE CARGA DE DATOS
# =============================================================================
def load_data_safe(filepath):
    """Cargar datos de forma segura con limpieza"""
    try:
        if os.path.exists(filepath):
            for encoding in ['utf-8-sig', 'utf-8', 'latin-1']:
                try:
                    df = pd.read_csv(filepath, encoding=encoding, low_memory=False)
                    print(f"✅ Cargado: {filepath} ({len(df):,} registros)")
                    
                    # Normalizar nombres de columnas
                    df.columns = df.columns.str.strip().str.lower()
                    
                    return df, None
                except:
                    continue
        return None, f"Archivo no encontrado: {filepath}"
    except Exception as e:
        return None, str(e)

print("="*80)
print("🚀 CARGANDO DATOS NASA ECUADOR - VERSIÓN MEJORADA CON ANÁLISIS ESTADÍSTICO")
print("="*80)

gldas_df, gldas_error = load_data_safe(DATABASES["GLDAS"])
gpm_df, gpm_error = load_data_safe(DATABASES["GPM"])
fire_df, fire_error = load_data_safe(DATABASES["FIRE"])

# =============================================================================
# PROCESAMIENTO DE DATOS MEJORADO
# =============================================================================
def process_fire_data(df):
    """Procesar datos de incendios con validación estricta"""
    if df is None:
        return None
    
    df = df.copy()
    print(f"🔥 PROCESANDO FIRE: {len(df):,} registros iniciales")
    
    # Procesar fecha
    date_cols = ['fecha_adquisicion', 'date', 'fecha', 'acq_date']
    for col in date_cols:
        if col in df.columns:
            df['fecha'] = pd.to_datetime(df[col], errors='coerce')
            df = df[df['fecha'].notna()]
            df['year'] = df['fecha'].dt.year
            df['month'] = df['fecha'].dt.month
            df['day'] = df['fecha'].dt.day
            df['day_of_year'] = df['fecha'].dt.dayofyear
            df['month_name'] = df['fecha'].dt.strftime('%b')
            df['date_str'] = df['fecha'].dt.strftime('%Y-%m-%d')
            df['week'] = df['fecha'].dt.isocalendar().week
            df['quarter'] = df['fecha'].dt.quarter
            break
    
    # Procesar coordenadas
    coord_cols = {
        'lat': ['latitud', 'latitude', 'lat'],
        'lon': ['longitud', 'longitude', 'lon', 'long']
    }
    
    for target, sources in coord_cols.items():
        for source in sources:
            if source in df.columns:
                df[target] = pd.to_numeric(df[source], errors='coerce')
                break
    
    # FILTRADO GEOGRÁFICO ESTRICTO
    df = filter_ecuador_land_only(df)
    
    # Limpiar nombres de provincias
    df = clean_province_names(df, 'provincia')
    
    # Procesar variables específicas
    if 'confianza' in df.columns:
        # Convertir confianza textual a numérica
        confidence_map = {'baja': 30, 'media': 60, 'alta': 90, 'nominal': 50}
        df['confidence'] = df['confianza'].str.lower().map(confidence_map)
        if df['confidence'].isna().all():
            df['confidence'] = 50  # Valor por defecto
    elif 'confidence' in df.columns:
        df['confidence'] = pd.to_numeric(df['confidence'], errors='coerce')
    else:
        df['confidence'] = 50
    
    if 'max_frp' in df.columns:
        df['frp'] = pd.to_numeric(df['max_frp'], errors='coerce')
    elif 'frp' in df.columns:
        df['frp'] = pd.to_numeric(df['frp'], errors='coerce')
    else:
        df['frp'] = 0
    
    # Remover datos inválidos
    df = remove_invalid_data(df)
    
    # Crear categorías mejoradas
    if 'confidence' in df.columns:
        df['confidence_cat'] = pd.cut(df['confidence'], 
                                    bins=[0, 30, 70, 100], 
                                    labels=['Baja', 'Media', 'Alta'])
    
    if 'frp' in df.columns:
        df['frp_cat'] = pd.cut(df['frp'], 
                             bins=[0, 10, 50, 100, float('inf')], 
                             labels=['Muy Baja', 'Baja', 'Media', 'Alta'])
        
        # Calcular percentiles para análisis estadístico
        df['frp_percentile'] = df['frp'].rank(pct=True) * 100
    
    print(f"✅ FIRE procesado: {len(df):,} registros válidos")
    return df

def process_gpm_data(df):
    """Procesar datos GPM con validación"""
    if df is None:
        return None
    
    df = df.copy()
    print(f"💧 PROCESANDO GPM: {len(df):,} registros iniciales")
    
    # Procesar fecha
    if 'fecha' in df.columns:
        df['fecha'] = pd.to_datetime(df['fecha'], errors='coerce')
        df = df[df['fecha'].notna()]
        df['year'] = df['fecha'].dt.year
        df['month'] = df['fecha'].dt.month
        df['day'] = df['fecha'].dt.day
        df['month_name'] = df['fecha'].dt.strftime('%b')
        df['date_str'] = df['fecha'].dt.strftime('%Y-%m-%d')
        df['week'] = df['fecha'].dt.isocalendar().week
        df['quarter'] = df['fecha'].dt.quarter
    
    # Coordenadas
    coord_cols = {
        'lat': ['lat', 'latitude', 'latitud'],
        'lon': ['lon', 'longitude', 'longitud', 'long']
    }
    
    for target, sources in coord_cols.items():
        for source in sources:
            if source in df.columns:
                df[target] = pd.to_numeric(df[source], errors='coerce')
                break
    
    # FILTRADO GEOGRÁFICO ESTRICTO
    df = filter_ecuador_land_only(df)
    
    # Limpiar provincias
    df = clean_province_names(df, 'provincia')
    
    # Procesar precipitación
    precip_cols = ['precipitation', 'precipitacion', 'precip', 'rain']
    for col in precip_cols:
        if col in df.columns:
            df['precipitation'] = pd.to_numeric(df[col], errors='coerce')
            # NO convertir unidades - los datos ya están en escala correcta
            break
    
    # Remover datos inválidos
    df = remove_invalid_data(df)
    
    # Análisis estadístico de precipitación
    if 'precipitation' in df.columns:
        df['precip_percentile'] = df['precipitation'].rank(pct=True) * 100
        
        # Calcular SPI (Standardized Precipitation Index) simplificado
        monthly_avg = df.groupby(['year', 'month'])['precipitation'].transform('mean')
        monthly_std = df.groupby(['year', 'month'])['precipitation'].transform('std')
        df['spi'] = (df['precipitation'] - monthly_avg) / (monthly_std + 0.01)
        
        # Categorías de sequía basadas en SPI
        df['drought_category'] = pd.cut(df['spi'], 
                                       bins=[-np.inf, -2, -1.5, -1, 1, 1.5, 2, np.inf],
                                       labels=['Sequía Extrema', 'Sequía Severa', 'Sequía Moderada', 
                                              'Normal', 'Húmedo Moderado', 'Húmedo Severo', 'Húmedo Extremo'])
    
    print(f"✅ GPM procesado: {len(df):,} registros válidos")
    return df

def process_gldas_data(df):
    """Procesar datos GLDAS con validación"""
    if df is None:
        return None
    
    df = df.copy()
    print(f"🌱 PROCESANDO GLDAS: {len(df):,} registros iniciales")
    
    # Procesar fecha
    time_cols = ['time', 'fecha', 'date']
    for col in time_cols:
        if col in df.columns:
            df['fecha'] = pd.to_datetime(df[col], errors='coerce')
            df = df[df['fecha'].notna()]
            df['year'] = df['fecha'].dt.year
            df['month'] = df['fecha'].dt.month
            df['day'] = df['fecha'].dt.day
            df['month_name'] = df['fecha'].dt.strftime('%b')
            df['date_str'] = df['fecha'].dt.strftime('%Y-%m-%d')
            df['week'] = df['fecha'].dt.isocalendar().week
            df['quarter'] = df['fecha'].dt.quarter
            break
    
    # Coordenadas
    coord_cols = {
        'lat': ['lat', 'latitude', 'latitud'],
        'lon': ['lon', 'longitude', 'longitud', 'long']
    }
    
    for target, sources in coord_cols.items():
        for source in sources:
            if source in df.columns:
                df[target] = pd.to_numeric(df[source], errors='coerce')
                break
    
    # FILTRADO GEOGRÁFICO ESTRICTO
    df = filter_ecuador_land_only(df)
    
    # Limpiar provincias
    df = clean_province_names(df, 'provincia')
    
    # Convertir temperaturas de Kelvin a Celsius
    temp_cols = ['tair_f_inst', 'soiltmp0_10cm_inst', 'temp_air', 'temp_soil']
    for col in temp_cols:
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors='coerce')
            if df[col].mean() > 200:  # Está en Kelvin
                df[f'{col}_c'] = df[col] - 273.15
    
    # Procesar variables climáticas clave
    climate_vars = ['soilmoi0_10cm_inst', 'soilmoi10_40cm_inst', 'rootmoist_inst', 
                   'rainf_tavg', 'qair_f_inst', 'psurf_f_inst', 'evap_tavg']
    for var in climate_vars:
        if var in df.columns:
            df[var] = pd.to_numeric(df[var], errors='coerce')
    
    # Calcular índices derivados
    if 'soilmoi0_10cm_inst' in df.columns:
        # Percentil de humedad
        df['moisture_percentile'] = df['soilmoi0_10cm_inst'].rank(pct=True) * 100
        
        # Categoría de estrés hídrico
        df['water_stress'] = pd.cut(df['soilmoi0_10cm_inst'],
                                   bins=[0, 100, 150, 200, float('inf')],
                                   labels=['Crítico', 'Alto', 'Moderado', 'Normal'])
    
    # Calcular balance hídrico si hay datos
    if 'rainf_tavg' in df.columns and 'evap_tavg' in df.columns:
        df['water_balance'] = df['rainf_tavg'] - df['evap_tavg']
        df['water_balance_cat'] = pd.cut(df['water_balance'],
                                        bins=[-np.inf, -0.00001, 0, 0.00001, np.inf],
                                        labels=['Déficit Alto', 'Déficit', 'Equilibrio', 'Superávit'])
    
    # Remover datos inválidos
    df = remove_invalid_data(df)
    
    print(f"✅ GLDAS procesado: {len(df):,} registros válidos")
    return df

# Procesar datasets
fire_df = process_fire_data(fire_df)
gpm_df = process_gpm_data(gpm_df)
gldas_df = process_gldas_data(gldas_df)

# =============================================================================
# FUNCIONES AUXILIARES PARA FILTROS
# =============================================================================
def get_unique_values(df, column):
    """Obtener valores únicos de una columna"""
    if df is None or column not in df.columns:
        return []
    return sorted(df[column].dropna().unique())

def get_cantons_by_province(df, province):
    """Obtener cantones filtrados por provincia"""
    if df is None or 'canton' not in df.columns or 'provincia' not in df.columns:
        return []
    if province == 'all':
        return sorted(df['canton'].dropna().unique())
    return sorted(df[df['provincia'] == province]['canton'].dropna().unique())

def get_date_range(df):
    """Obtener rango de fechas"""
    if df is None or 'fecha' not in df.columns:
        return None, None
    return df['fecha'].min().date(), df['fecha'].max().date()

# =============================================================================
# ANÁLISIS ESTADÍSTICO AVANZADO
# =============================================================================
def calculate_statistical_summary(df, variable):
    """Calcular resumen estadístico completo"""
    if df is None or variable not in df.columns:
        return None
    
    data = df[variable].dropna()
    
    if len(data) == 0:
        return None
    
    summary = {
        'count': len(data),
        'mean': data.mean(),
        'median': data.median(),
        'std': data.std(),
        'min': data.min(),
        'max': data.max(),
        'q25': data.quantile(0.25),
        'q75': data.quantile(0.75),
        'iqr': data.quantile(0.75) - data.quantile(0.25),
        'cv': (data.std() / data.mean()) * 100 if data.mean() != 0 else 0,
        'skewness': stats.skew(data),
        'kurtosis': stats.kurtosis(data)
    }
    
    # Test de normalidad
    if len(data) > 8 and len(data) < 5000:
        _, p_value = stats.shapiro(data)
        summary['is_normal'] = p_value > 0.05
        summary['normality_p'] = p_value
    
    return summary

def detect_outliers(df, variable, method='iqr'):
    """Detectar outliers usando múltiples métodos"""
    if df is None or variable not in df.columns:
        return None
    
    data = df[variable].dropna()
    
    if len(data) == 0:
        return None
    
    outliers = {}
    
    # Método IQR
    if method in ['iqr', 'all']:
        q1 = data.quantile(0.25)
        q3 = data.quantile(0.75)
        iqr = q3 - q1
        lower_bound = q1 - 1.5 * iqr
        upper_bound = q3 + 1.5 * iqr
        outliers['iqr'] = {
            'lower': lower_bound,
            'upper': upper_bound,
            'count': ((data < lower_bound) | (data > upper_bound)).sum(),
            'percentage': (((data < lower_bound) | (data > upper_bound)).sum() / len(data)) * 100
        }
    
    # Método Z-score
    if method in ['zscore', 'all']:
        z_scores = np.abs(stats.zscore(data))
        outliers['zscore'] = {
            'count': (z_scores > 3).sum(),
            'percentage': ((z_scores > 3).sum() / len(data)) * 100
        }
    
    return outliers

def calculate_trend(df, date_col, value_col):
    """Calcular tendencia temporal usando regresión lineal"""
    if df is None or date_col not in df.columns or value_col not in df.columns:
        return None
    
    df_temp = df[[date_col, value_col]].dropna()
    
    if len(df_temp) < 3:
        return None
    
    # Convertir fechas a números
    df_temp['date_numeric'] = (df_temp[date_col] - df_temp[date_col].min()).dt.days
    
    # Regresión lineal
    slope, intercept, r_value, p_value, std_err = stats.linregress(
        df_temp['date_numeric'], df_temp[value_col]
    )
    
    return {
        'slope': slope,
        'intercept': intercept,
        'r_squared': r_value**2,
        'p_value': p_value,
        'direction': 'increasing' if slope > 0 else 'decreasing',
        'significant': p_value < 0.05
    }

def calculate_spatial_autocorrelation(df):
    """Calcular autocorrelación espacial (Índice de Moran simplificado)"""
    if df is None or not all(col in df.columns for col in ['lat', 'lon']):
        return None
    
    # Simplificado para grandes datasets
    if len(df) > 1000:
        df_sample = df.sample(1000)
    else:
        df_sample = df.copy()
    
    # Calcular distancias entre puntos (simplificado)
    coords = df_sample[['lat', 'lon']].values
    distances = np.sqrt(((coords[:, np.newaxis] - coords) ** 2).sum(axis=2))
    
    # Identificar clusters
    threshold = np.percentile(distances[distances > 0], 10)  # 10% de distancias más cercanas
    
    return {
        'avg_distance': distances[distances > 0].mean(),
        'cluster_threshold': threshold,
        'spatial_pattern': 'clustered' if threshold < distances.mean() * 0.3 else 'dispersed'
    }

# =============================================================================
# FUNCIONES DE ANÁLISIS E INSIGHTS MEJORADAS
# =============================================================================
def generate_fire_insights(df):
    """Generar insights avanzados para datos de incendios"""
    insights = {}
    
    if df is None or len(df) == 0:
        return {
            'spatial': "No hay datos suficientes para análisis espacial.",
            'temporal': "No hay datos suficientes para análisis temporal.",
            'statistical': "No hay datos suficientes para análisis estadístico.",
            'risk': "No hay datos suficientes para análisis de riesgo."
        }
    
    # ANÁLISIS ESPACIAL MEJORADO
    if 'frp' in df.columns and 'provincia' in df.columns:
        province_stats = df.groupby('provincia')['frp'].agg(['mean', 'median', 'std', 'count'])
        top_province = province_stats['mean'].idxmax()
        top_frp_mean = province_stats.loc[top_province, 'mean']
        top_frp_std = province_stats.loc[top_province, 'std']
        top_count = province_stats.loc[top_province, 'count']
        
        # Calcular variabilidad
        cv = (top_frp_std / top_frp_mean) * 100 if top_frp_mean > 0 else 0
        
        insights['spatial'] = (
            f"🔥 **Análisis Espacial Crítico**: {top_province} presenta la mayor intensidad promedio "
            f"({top_frp_mean:.1f} MW ± {top_frp_std:.1f}, CV={cv:.1f}%) con {int(top_count)} detecciones. "
            f"{'Alta variabilidad indica incendios intermitentes pero intensos.' if cv > 50 else 'Variabilidad moderada sugiere incendios persistentes.'} "
            f"\n\n**Recomendación**: Establecer centro de comando permanente en {top_province}. "
            f"Desplegar {'equipos especializados para incendios forestales de gran magnitud' if top_frp_mean > 50 else 'brigadas de respuesta rápida'}. "
            f"Implementar sistema de alerta temprana en un radio de 5km de hotspots activos."
        )
    
    # ANÁLISIS TEMPORAL CON TENDENCIA
    if 'fecha' in df.columns:
        trend_info = calculate_trend(df, 'fecha', 'frp' if 'frp' in df.columns else 'confidence')
        
        # Análisis de periodicidad
        df_recent = df[df['fecha'] >= df['fecha'].max() - pd.Timedelta(days=7)]
        df_prev_week = df[(df['fecha'] >= df['fecha'].max() - pd.Timedelta(days=14)) & 
                         (df['fecha'] < df['fecha'].max() - pd.Timedelta(days=7))]
        
        recent_count = len(df_recent)
        prev_count = len(df_prev_week) if len(df_prev_week) > 0 else 1
        change_pct = ((recent_count - prev_count) / prev_count) * 100
        
        # Análisis estacional
        monthly_avg = df.groupby('month').size().mean()
        current_month = df[df['fecha'].dt.month == df['fecha'].max().month]
        current_month_count = len(current_month)
        
        temporal_text = f"📈 **Análisis Temporal**: "
        
        if trend_info and trend_info['significant']:
            temporal_text += f"Tendencia {'ascendente' if trend_info['direction'] == 'increasing' else 'descendente'} "
            temporal_text += f"estadísticamente significativa (R²={trend_info['r_squared']:.3f}, p<0.05). "
        
        temporal_text += f"Última semana: {recent_count} incendios "
        
        if change_pct > 50:
            temporal_text += f"(⚠️ AUMENTO CRÍTICO +{change_pct:.0f}% vs semana anterior). "
        elif change_pct > 20:
            temporal_text += f"(⚠️ incremento moderado +{change_pct:.0f}%). "
        elif change_pct < -20:
            temporal_text += f"(✅ reducción -{abs(change_pct):.0f}%). "
        else:
            temporal_text += f"(estable, {change_pct:+.0f}%). "
        
        if current_month_count > monthly_avg * 1.5:
            temporal_text += f"\n\n🔔 **Alerta**: Mes actual con {current_month_count} incendios "
            temporal_text += f"(+{((current_month_count/monthly_avg - 1) * 100):.0f}% sobre promedio histórico). "
            temporal_text += "Posible inicio de temporada alta de incendios."
        
        temporal_text += (
            f"\n\n**Acciones Inmediatas**: "
            f"{'Activar protocolo de emergencia nivel 2. ' if change_pct > 50 else ''}"
            f"Incrementar frecuencia de patrullajes a cada 4 horas. "
            f"Coordinar con meteorología para pronóstico de vientos. "
            f"Preparar evacuaciones preventivas en zonas de riesgo."
        )
        
        insights['temporal'] = temporal_text
    
    # ANÁLISIS ESTADÍSTICO AVANZADO
    if 'frp' in df.columns:
        frp_stats = calculate_statistical_summary(df, 'frp')
        outlier_info = detect_outliers(df, 'frp', method='iqr')
        
        if frp_stats:
            stat_text = f"📊 **Análisis Estadístico**: "
            stat_text += f"Intensidad promedio {frp_stats['mean']:.1f} MW (±{frp_stats['std']:.1f}), "
            stat_text += f"mediana {frp_stats['median']:.1f} MW. "
            
            if frp_stats['skewness'] > 1:
                stat_text += "Distribución altamente asimétrica positiva indica mayoría de incendios pequeños con eventos extremos ocasionales. "
            elif frp_stats['skewness'] < -1:
                stat_text += "Distribución asimétrica negativa (inusual) sugiere predominio de incendios de alta intensidad. "
            
            if outlier_info and outlier_info['iqr']['count'] > 0:
                stat_text += f"\n\n⚠️ **Eventos Atípicos**: {outlier_info['iqr']['count']} incendios "
                stat_text += f"({outlier_info['iqr']['percentage']:.1f}%) clasificados como outliers (FRP >{outlier_info['iqr']['upper']:.1f} MW). "
                stat_text += "Requieren investigación especial y recursos adicionales."
            
            # Coeficiente de variación
            if frp_stats['cv'] > 100:
                stat_text += f"\n\n**Variabilidad Extrema** (CV={frp_stats['cv']:.0f}%): "
                stat_text += "Los incendios varían drásticamente en intensidad. Preparar recursos flexibles para eventos de múltiples escalas."
            
            insights['statistical'] = stat_text
    
    # ANÁLISIS DE RIESGO Y PATRONES ESPACIALES
    if all(col in df.columns for col in ['lat', 'lon', 'provincia']):
        spatial_info = calculate_spatial_autocorrelation(df)
        
        risk_text = f"🎯 **Evaluación de Riesgo**: "
        
        if spatial_info:
            if spatial_info['spatial_pattern'] == 'clustered':
                risk_text += "Patrón espacial AGRUPADO detectado. Incendios tienden a concentrarse en áreas específicas. "
                risk_text += "Priorizar protección de zonas adyacentes a clusters activos. "
            else:
                risk_text += "Patrón DISPERSO indica incendios aislados en múltiples frentes. "
                risk_text += "Requerirá coordinación multi-provincial y recursos distribuidos. "
        
        # Análisis de confianza
        if 'confidence' in df.columns:
            high_conf_pct = (df['confidence'] > 70).sum() / len(df) * 100
            
            risk_text += f"\n\n**Confiabilidad de Datos**: {high_conf_pct:.0f}% detecciones alta confianza (>70%). "
            
            if high_conf_pct < 50:
                risk_text += "⚠️ Confianza baja requiere verificación en campo antes de movilizar recursos mayores. "
            elif high_conf_pct > 80:
                risk_text += "✅ Alta confiabilidad permite toma de decisiones inmediata basada en datos satelitales."
        
        # Concentración provincial
        province_concentration = df['provincia'].value_counts()
        herfindahl_index = ((province_concentration / province_concentration.sum()) ** 2).sum()
        
        if herfindahl_index > 0.25:
            top_3_provinces = province_concentration.head(3)
            risk_text += f"\n\n**Concentración Regional**: {(herfindahl_index*100):.0f}% de incendios en pocas provincias. "
            risk_text += f"Focos principales: {', '.join(top_3_provinces.index.tolist())}. "
            risk_text += "Centralizar equipos en estas zonas para respuesta rápida <30 minutos."
        
        insights['risk'] = risk_text
    
    return insights

def generate_precipitation_insights(df):
    """Generar insights avanzados para datos de precipitación"""
    insights = {}
    
    if df is None or len(df) == 0:
        return {
            'temporal': "No hay datos suficientes para análisis temporal.",
            'spatial': "No hay datos suficientes para análisis espacial.",
            'hydrological': "No hay datos suficientes para análisis hidrológico.",
            'agricultural': "No hay datos suficientes para análisis agrícola."
        }
    
    # ANÁLISIS TEMPORAL CON SPI
    if 'precipitation' in df.columns and 'fecha' in df.columns:
        precip_stats = calculate_statistical_summary(df, 'precipitation')
        trend_info = calculate_trend(df, 'fecha', 'precipitation')
        
        # Análisis mensual
        monthly_precip = df.groupby(df['fecha'].dt.to_period('M'))['precipitation'].agg(['mean', 'sum', 'std'])
        current_month = monthly_precip.iloc[-1] if len(monthly_precip) > 0 else None
        historical_mean = monthly_precip['mean'].mean()
        historical_std = monthly_precip['mean'].std()
        
        temporal_text = f"💧 **Análisis Hidrometeorológico**: "
        
        if precip_stats:
            temporal_text += f"Precipitación promedio {precip_stats['mean']:.3f} mm/hr "
            temporal_text += f"(mediana {precip_stats['median']:.3f} mm/hr). "
        
        if current_month is not None:
            z_score = (current_month['mean'] - historical_mean) / (historical_std + 0.001)
            
            if z_score < -2:
                temporal_text += f"\n\n🚨 **SEQUÍA SEVERA** (Z-score: {z_score:.2f}): "
                temporal_text += f"Precipitación actual {current_month['mean']:.2f} mm/hr, "
                temporal_text += f"{abs((1 - current_month['mean']/historical_mean) * 100):.0f}% bajo el promedio histórico. "
                temporal_text += "\n**Acciones Críticas**: "
                temporal_text += "• Declarar emergencia hídrica provincial\n"
                temporal_text += "• Restringir uso de agua no esencial inmediatamente\n"
                temporal_text += "• Activar distribución de agua por tanqueros\n"
                temporal_text += "• Implementar racionamiento en zonas urbanas"
            elif z_score < -1:
                temporal_text += f"\n\n⚠️ **Déficit Hídrico Moderado** (Z-score: {z_score:.2f}): "
                temporal_text += f"Precipitación {abs((1 - current_month['mean']/historical_mean) * 100):.0f}% bajo promedio. "
                temporal_text += "\n**Recomendaciones**: "
                temporal_text += "• Promover uso eficiente del agua\n"
                temporal_text += "• Aumentar monitoreo de reservorios\n"
                temporal_text += "• Preparar campañas de concientización"
            elif z_score > 2:
                temporal_text += f"\n\n🌊 **Precipitación Excesiva** (Z-score: {z_score:.2f}): "
                temporal_text += f"Precipitación {((current_month['mean']/historical_mean - 1) * 100):.0f}% sobre promedio. "
                temporal_text += "\n**Alertas**: "
                temporal_text += "• Riesgo de inundaciones y deslizamientos\n"
                temporal_text += "• Monitorear niveles de ríos cada 6 horas\n"
                temporal_text += "• Activar planes de evacuación preventiva\n"
                temporal_text += "• Inspeccionar infraestructura vial"
            else:
                temporal_text += f"Condiciones normales (Z-score: {z_score:.2f}). "
        
        # Tendencia
        if trend_info and trend_info['significant']:
            temporal_text += f"\n\n📉 **Tendencia Significativa**: "
            temporal_text += f"{'Incremento' if trend_info['direction'] == 'increasing' else 'Reducción'} "
            temporal_text += f"sistemático en precipitación (R²={trend_info['r_squared']:.3f}). "
            if trend_info['direction'] == 'decreasing':
                temporal_text += "⚠️ Posible transición hacia condiciones más secas a largo plazo."
        
        insights['temporal'] = temporal_text
    
    # ANÁLISIS ESPACIAL DE PRECIPITACIÓN
    if 'precipitation' in df.columns and 'provincia' in df.columns:
        province_precip = df.groupby('provincia')['precipitation'].agg(['mean', 'std', 'count', 'min', 'max'])
        driest = province_precip['mean'].idxmin()
        wettest = province_precip['mean'].idxmax()
        
        spatial_text = f"🗺️ **Distribución Espacial**: "
        spatial_text += f"\n• **Zona más seca**: {driest} ({province_precip.loc[driest, 'mean']:.3f} mm/hr promedio, "
        spatial_text += f"máx {province_precip.loc[driest, 'max']:.3f} mm/hr)"
        spatial_text += f"\n• **Zona más húmeda**: {wettest} ({province_precip.loc[wettest, 'mean']:.3f} mm/hr promedio)"
        
        # Calcular disparidad regional
        cv_regional = (province_precip['mean'].std() / province_precip['mean'].mean()) * 100
        
        spatial_text += f"\n\n**Variabilidad Regional** (CV={cv_regional:.0f}%): "
        
        if cv_regional > 50:
            spatial_text += "Alta heterogeneidad espacial. Políticas hídricas deben adaptarse localmente. "
        
        spatial_text += f"\n\n**Prioridades de Acción en {driest}**:"
        spatial_text += f"\n• Instalar sistemas de captación de agua lluvia"
        spatial_text += f"\n• Implementar riego tecnificado (goteo/microaspersión)"
        spatial_text += f"\n• Incentivar cultivos resistentes a sequía"
        spatial_text += f"\n• Construir reservorios comunitarios"
        
        insights['spatial'] = spatial_text
    
    # ANÁLISIS HIDROLÓGICO
    if 'precipitation' in df.columns and 'fecha' in df.columns:
        # Análisis de días secos consecutivos
        daily_precip = df.groupby('fecha')['precipitation'].mean().reset_index()
        daily_precip['is_dry'] = daily_precip['precipitation'] < 0.001  # <1mm/hr
        
        # Encontrar secuencias de días secos
        dry_sequences = []
        current_seq = 0
        for is_dry in daily_precip['is_dry']:
            if is_dry:
                current_seq += 1
            else:
                if current_seq > 0:
                    dry_sequences.append(current_seq)
                current_seq = 0
        
        max_dry_days = max(dry_sequences) if dry_sequences else 0
        avg_dry_seq = np.mean(dry_sequences) if dry_sequences else 0
        
        hydro_text = f"💦 **Análisis Hidrológico**: "
        
        if max_dry_days > 30:
            hydro_text += f"\n🚨 **ALERTA CRÍTICA**: Período seco máximo de {max_dry_days} días consecutivos. "
            hydro_text += "Sequía prolongada afecta gravemente reservas hídricas. "
        elif max_dry_days > 14:
            hydro_text += f"\n⚠️ **Atención**: Hasta {max_dry_days} días consecutivos sin lluvia significativa. "
        else:
            hydro_text += f"\n✅ Máximo {max_dry_days} días secos consecutivos (dentro de rangos normales). "
        
        # Intensidad de eventos
        if 'precipitation' in df.columns:
            high_intensity_events = df[df['precipitation'] > df['precipitation'].quantile(0.95)]
            
            if len(high_intensity_events) > 0:
                hydro_text += f"\n\n**Eventos de Alta Intensidad**: {len(high_intensity_events)} registros "
                hydro_text += f"(>{df['precipitation'].quantile(0.95):.3f} mm/hr). "
                hydro_text += "\nRiesgo de escorrentía superficial y erosión del suelo. "
                hydro_text += "Implementar obras de conservación de suelos y zanjas de infiltración."
        
        # Análisis de sequía por SPI
        if 'spi' in df.columns:
            drought_levels = df['drought_category'].value_counts()
            
            if 'Sequía Severa' in drought_levels or 'Sequía Extrema' in drought_levels:
                severe_count = drought_levels.get('Sequía Severa', 0) + drought_levels.get('Sequía Extrema', 0)
                hydro_text += f"\n\n🔴 **Índice de Sequía (SPI)**: {severe_count} registros en categoría severa/extrema. "
                hydro_text += "Índice Estandarizado de Precipitación indica estrés hídrico significativo."
        
        insights['hydrological'] = hydro_text
    
    # ANÁLISIS PARA AGRICULTURA
    if 'precipitation' in df.columns:
        # Calcular días con lluvia útil (>5mm/día equivalente)
        useful_rain_days = (df['precipitation'] > 0.005).sum()  # >5mm/día asumiendo lectura horaria
        total_days = len(df['fecha'].unique()) if 'fecha' in df.columns else len(df)
        useful_rain_pct = (useful_rain_days / total_days * 100) if total_days > 0 else 0
        
        agri_text = f"🌾 **Implicaciones Agrícolas**: "
        
        if useful_rain_pct < 30:
            agri_text += f"\n⚠️ Solo {useful_rain_pct:.0f}% de días con lluvia útil para cultivos. "
            agri_text += "\n**Recomendaciones Agrícolas**:"
            agri_text += "\n• Priorizar cultivos de ciclo corto y resistentes (quinoa, amaranto, cebada)"
            agri_text += "\n• Implementar mulching para retención de humedad"
            agri_text += "\n• Establecer sistemas de riego suplementario obligatorio"
            agri_text += "\n• Ajustar calendarios de siembra a ventanas óptimas"
            agri_text += "\n• Considerar seguros agrícolas contra sequía"
        elif useful_rain_pct < 50:
            agri_text += f"\n⚠️ {useful_rain_pct:.0f}% de días con lluvia útil - condiciones subóptimas. "
            agri_text += "\n**Estrategias de Adaptación**:"
            agri_text += "\n• Diversificar cultivos (no monocultivo)"
            agri_text += "\n• Usar variedades mejoradas tolerantes a estrés hídrico"
            agri_text += "\n• Implementar cosecha de agua en parcelas"
            agri_text += "\n• Aplicar técnicas de labranza mínima"
        else:
            agri_text += f"\n✅ {useful_rain_pct:.0f}% de días con lluvia útil - condiciones favorables. "
            agri_text += "\n**Oportunidades**:"
            agri_text += "\n• Momento óptimo para cultivos de ciclo largo"
            agri_text += "\n• Aprovechar para recargar acuíferos"
            agri_text += "\n• Establecer cultivos de cobertura"
        
        insights['agricultural'] = agri_text
    
    return insights

def generate_soil_insights(df, fire_data=None):
    """Generar insights avanzados para datos de suelo y clima"""
    insights = {}
    
    if df is None or len(df) == 0:
        return {
            'moisture': "No hay datos suficientes para análisis de humedad.",
            'temperature': "No hay datos suficientes para análisis térmico.",
            'correlation': "No hay datos suficientes para correlación.",
            'integrated': "No hay datos suficientes para análisis integrado."
        }
    
    # ANÁLISIS DE HUMEDAD DEL SUELO
    if 'soilmoi0_10cm_inst' in df.columns:
        moisture_stats = calculate_statistical_summary(df, 'soilmoi0_10cm_inst')
        
        moisture_text = f"💧 **Análisis de Humedad Edáfica**: "
        
        if moisture_stats:
            moisture_text += f"Humedad superficial promedio {moisture_stats['mean']:.1f} "
            moisture_text += f"(rango: {moisture_stats['min']:.1f}-{moisture_stats['max']:.1f}). "
            
            # Clasificación basada en umbrales agronómicos
            critical_threshold = 100  # Punto de marchitez permanente aprox.
            field_capacity = 250  # Capacidad de campo aprox.
            
            if moisture_stats['mean'] < critical_threshold:
                moisture_text += f"\n\n🚨 **CRISIS HÍDRICA SEVERA** (humedad <{critical_threshold}): "
                moisture_text += "Nivel por debajo del punto de marchitez permanente. "
                moisture_text += "\n**Impactos Críticos**:"
                moisture_text += "\n• Cultivos en estado crítico - pérdidas inminentes"
                moisture_text += "\n• Alto riesgo de incendios forestales"
                moisture_text += "\n• Erosión eólica del suelo desprotegido"
                moisture_text += "\n• Compactación del suelo por desecación"
                moisture_text += "\n\n**Acciones Urgentes**:"
                moisture_text += "\n• Riego de emergencia 24/7 en cultivos prioritarios"
                moisture_text += "\n• Prohibir quemas agrícolas completamente"
                moisture_text += "\n• Activar brigadas anti-incendios en alerta máxima"
                moisture_text += "\n• Aplicar enmiendas orgánicas para retención de humedad"
            elif moisture_stats['mean'] < field_capacity * 0.6:
                moisture_text += f"\n\n⚠️ **Estrés Hídrico Moderado-Alto**: "
                moisture_text += f"Humedad {((moisture_stats['mean']/field_capacity)*100):.0f}% de capacidad de campo. "
                moisture_text += "\n**Medidas Recomendadas**:"
                moisture_text += "\n• Iniciar riego suplementario inmediatamente"
                moisture_text += "\n• Monitoreo diario de humedad del suelo"
                moisture_text += "\n• Suspender actividades que remuevan suelo"
                moisture_text += "\n• Incrementar vigilancia de incendios"
            else:
                moisture_text += f"\n\n✅ **Humedad Adecuada**: "
                moisture_text += f"{((moisture_stats['mean']/field_capacity)*100):.0f}% de capacidad de campo. "
                moisture_text += "Condiciones óptimas para desarrollo vegetal."
            
            # Variabilidad espacial
            if moisture_stats['cv'] > 50:
                moisture_text += f"\n\n**Alta Heterogeneidad Espacial** (CV={moisture_stats['cv']:.0f}%): "
                moisture_text += "Humedad varía significativamente entre ubicaciones. "
                moisture_text += "Implementar manejo diferenciado por zonas (agricultura de precisión)."
            
            # Análisis de tendencia
            if 'fecha' in df.columns:
                moisture_trend = calculate_trend(df, 'fecha', 'soilmoi0_10cm_inst')
                if moisture_trend and moisture_trend['significant']:
                    if moisture_trend['direction'] == 'decreasing':
                        moisture_text += f"\n\n📉 **Tendencia Decreciente Significativa** (p<0.05): "
                        moisture_text += "Desecación progresiva del suelo. Anticipar agravamiento de condiciones."
                    else:
                        moisture_text += f"\n\n📈 **Tendencia Creciente**: Recuperación gradual de humedad del suelo."
        
        insights['moisture'] = moisture_text
    
    # ANÁLISIS DE TEMPERATURA
    if 'tair_f_inst_c' in df.columns or 'soiltmp0_10cm_inst' in df.columns:
        temp_text = f"🌡️ **Análisis Térmico**: "
        
        if 'tair_f_inst_c' in df.columns:
            air_temp_stats = calculate_statistical_summary(df, 'tair_f_inst_c')
            
            if air_temp_stats:
                temp_text += f"\nTemperatura del aire: {air_temp_stats['mean']:.1f}°C promedio "
                temp_text += f"(máx: {air_temp_stats['max']:.1f}°C). "
                
                # Clasificación de estrés térmico
                if air_temp_stats['mean'] > 30:
                    temp_text += "\n\n🔥 **Estrés Térmico Severo**: "
                    temp_text += "\n• Riesgo extremo de evapotranspiración"
                    temp_text += "\n• Cultivos requieren riego nocturno adicional"
                    temp_text += "\n• Implementar sombreaderos en ganadería"
                    temp_text += "\n• Ajustar jornadas de trabajo agrícola a horas frescas"
                elif air_temp_stats['mean'] > 26:
                    temp_text += f"\n⚠️ **Temperaturas Elevadas**: "
                    temp_text += "Incrementar frecuencia de riego. Monitorear cultivos sensibles."
                elif air_temp_stats['mean'] < 10:
                    temp_text += f"\n❄️ **Riesgo de Heladas**: "
                    temp_text += "Proteger cultivos sensibles. Considerar calefacción en invernaderos."
                else:
                    temp_text += "\n✅ Rango térmico óptimo para agricultura."
                
                # Amplitud térmica
                thermal_amplitude = air_temp_stats['max'] - air_temp_stats['min']
                if thermal_amplitude > 15:
                    temp_text += f"\n\n**Alta Amplitud Térmica** ({thermal_amplitude:.1f}°C): "
                    temp_text += "Variaciones extremas día-noche estresan cultivos. "
                    temp_text += "Usar mulching para amortiguar cambios térmicos."
        
        if 'soiltmp0_10cm_inst' in df.columns:
            # Convertir a Celsius si está en Kelvin
            if df['soiltmp0_10cm_inst'].mean() > 200:
                soil_temp = df['soiltmp0_10cm_inst'] - 273.15
            else:
                soil_temp = df['soiltmp0_10cm_inst']
            
            soil_temp_mean = soil_temp.mean()
            
            temp_text += f"\n\nTemperatura del suelo (0-10cm): {soil_temp_mean:.1f}°C. "
            
            if soil_temp_mean > 35:
                temp_text += "⚠️ Temperatura excesiva puede dañar raíces y microbiota del suelo."
            elif soil_temp_mean < 10:
                temp_text += "⚠️ Temperatura baja ralentiza actividad microbiana y absorción de nutrientes."
        
        insights['temperature'] = temp_text
    
    # CORRELACIÓN CON INCENDIOS
    if fire_data is not None and len(fire_data) > 0 and 'soilmoi0_10cm_inst' in df.columns:
        corr_text = f"🔗 **Correlación Suelo-Incendios**: "
        
        # Análisis por categorías de humedad
        df_temp = df.copy()
        df_temp['moisture_category'] = pd.cut(df_temp['soilmoi0_10cm_inst'],
                                             bins=[0, 100, 150, 200, float('inf')],
                                             labels=['Crítica', 'Baja', 'Moderada', 'Alta'])
        
        # Contar incendios por mes y provincia
        fire_monthly = fire_data.groupby(['year', 'month', 'provincia']).size().reset_index(name='fire_count')
        soil_monthly = df_temp.groupby(['year', 'month', 'provincia'])['soilmoi0_10cm_inst'].mean().reset_index()
        
        merged = pd.merge(soil_monthly, fire_monthly, on=['year', 'month', 'provincia'], how='inner')
        
        if len(merged) > 10:
            # Calcular correlación de Pearson
            correlation, p_value = stats.pearsonr(merged['soilmoi0_10cm_inst'], merged['fire_count'])
            
            corr_text += f"\nCoeficiente de correlación: {correlation:.3f} "
            corr_text += f"({'significativo' if p_value < 0.05 else 'no significativo'}, p={p_value:.4f}). "
            
            if correlation < -0.5 and p_value < 0.05:
                corr_text += "\n\n🔥 **Correlación Negativa Fuerte**: "
                corr_text += "Humedad baja del suelo está FUERTEMENTE asociada con más incendios. "
                corr_text += "\n\n**Modelo Predictivo Recomendado**:"
                corr_text += f"\n• Cuando humedad <150: Probabilidad de incendios aumenta {abs(correlation)*100:.0f}%"
                corr_text += "\n• Implementar alerta automática cuando humedad cruza umbral crítico"
                corr_text += "\n• Desplegar recursos preventivos 48h antes de condiciones críticas"
            elif correlation < -0.3 and p_value < 0.05:
                corr_text += "\n\n⚠️ **Correlación Negativa Moderada**: "
                corr_text += "Existe relación entre humedad baja e incendios, pero otros factores también influyen. "
                corr_text += "Integrar datos de viento, temperatura y cobertura vegetal para predicción mejorada."
            else:
                corr_text += "\n\nCorrelación débil o no significativa. "
                corr_text += "Incendios pueden estar más influenciados por factores antropogénicos que climáticos."
            
            # Análisis de riesgo por provincia
            risk_provinces = merged[merged['soilmoi0_10cm_inst'] < 150].groupby('provincia')['fire_count'].mean().sort_values(ascending=False).head(3)
            
            if len(risk_provinces) > 0:
                corr_text += f"\n\n**Provincias de Alto Riesgo** (humedad <150 + incendios frecuentes):"
                for prov, fire_avg in risk_provinces.items():
                    corr_text += f"\n• {prov}: Promedio {fire_avg:.1f} incendios/mes en condiciones secas"
        else:
            corr_text += "Datos insuficientes para análisis de correlación robusto."
        
        insights['correlation'] = corr_text
    
    # ANÁLISIS INTEGRADO MULTI-VARIABLE
    if all(var in df.columns for var in ['soilmoi0_10cm_inst', 'rainf_tavg', 'evap_tavg']):
        integrated_text = f"🌐 **Análisis Integrado del Sistema Suelo-Atmósfera**: "
        
        # Balance hídrico
        if 'water_balance' in df.columns:
            deficit_days = (df['water_balance'] < 0).sum()
            total_days = len(df)
            deficit_pct = (deficit_days / total_days * 100) if total_days > 0 else 0
            
            integrated_text += f"\n\n**Balance Hídrico**: {deficit_pct:.0f}% días con déficit (evaporación > precipitación). "
            
            if deficit_pct > 70:
                integrated_text += "\n🚨 Sistema en desbalance crítico: "
                integrated_text += "\n• Pérdida neta de agua del sistema"
                integrated_text += "\n• Agotamiento progresivo de reservas"
                integrated_text += "\n• Necesidad urgente de fuentes alternativas"
            elif deficit_pct > 50:
                integrated_text += "\n⚠️ Déficit hídrico significativo. "
            else:
                integrated_text += "\n✅ Balance hídrico favorable."
# Análisis de eficiencia del agua
        rain_mean = df['rainf_tavg'].mean()
        evap_mean = df['evap_tavg'].mean()
        
        if rain_mean > 0:
            water_efficiency = (1 - evap_mean/rain_mean) * 100
            integrated_text += f"\n**Eficiencia de Retención**: {water_efficiency:.1f}% del agua precipitada se retiene. "
            
            if water_efficiency < 30:
                integrated_text += "\n⚠️ Baja eficiencia - alta evaporación relativa. "
                integrated_text += "Implementar cobertura vegetal y mulching."
        
        # Índice de estrés ambiental compuesto
        if 'soilmoi0_10cm_inst' in df.columns and 'tair_f_inst_c' in df.columns:
            # Normalizar variables
            moisture_normalized = (df['soilmoi0_10cm_inst'] - df['soilmoi0_10cm_inst'].min()) / (df['soilmoi0_10cm_inst'].max() - df['soilmoi0_10cm_inst'].min())
            temp_normalized = (df['tair_f_inst_c'] - df['tair_f_inst_c'].min()) / (df['tair_f_inst_c'].max() - df['tair_f_inst_c'].min())
            
            # Índice compuesto (mayor = más estrés)
            stress_index = (1 - moisture_normalized) * 0.6 + temp_normalized * 0.4
            stress_mean = stress_index.mean()
            
            integrated_text += f"\n\n**Índice de Estrés Ambiental Compuesto**: {stress_mean:.2f} (0=óptimo, 1=crítico). "
            
            if stress_mean > 0.7:
                integrated_text += "\n🚨 Estrés ambiental severo. Ecosistema bajo presión extrema."
            elif stress_mean > 0.5:
                integrated_text += "\n⚠️ Estrés moderado. Monitorear evolución."
            else:
                integrated_text += "\n✅ Condiciones ambientales dentro de rangos tolerables."
        
        insights['integrated'] = integrated_text
    
    return insights        

# =============================================================================
# FUNCIONES DE VISUALIZACIÓN MEJORADAS
# =============================================================================
def create_fire_heatmap(df):
    """Mapa de calor de incendios mejorado"""
    if df is None or not all(col in df.columns for col in ['lat', 'lon']):
        return go.Figure().add_annotation(text="Datos geográficos no disponibles", x=0.5, y=0.5)
    
    if len(df) > 3000:
        df_sample = df.sample(3000)
    else:
        df_sample = df.copy()
    
    if 'frp' in df_sample.columns:
        size_col = 'frp'
        color_col = 'frp'
        colorbar_title = "FRP (MW)"
        size_scale = 0.5
    elif 'confidence' in df_sample.columns:
        size_col = 'confidence'
        color_col = 'confidence'
        colorbar_title = "Confianza (%)"
        size_scale = 0.2
    else:
        df_sample['size'] = 8
        size_col = 'size'
        color_col = 'size'
        colorbar_title = "Detecciones"
        size_scale = 1
    
    fig = go.Figure(data=go.Scattermapbox(
        lat=df_sample['lat'],
        lon=df_sample['lon'],
        mode='markers',
        marker=dict(
            size=np.sqrt(df_sample[size_col]) * size_scale + 5,
            color=df_sample[color_col],
            colorscale='Hot',
            showscale=True,
            colorbar=dict(title=colorbar_title),
            opacity=0.7
        ),
        text=[f"<b>{prov}</b><br>Fecha: {fecha}<br>{colorbar_title}: {val:.1f}" 
              for prov, fecha, val in zip(
                  df_sample.get('provincia', ['N/A']*len(df_sample)),
                  df_sample.get('date_str', ['N/A']*len(df_sample)),
                  df_sample[color_col]
              )],
        hovertemplate='%{text}<extra></extra>',
        name='Hotspots'
    ))
    
    fig.update_layout(
        mapbox=dict(
            style="open-street-map",
            center=ECUADOR_CENTER,
            zoom=6
        ),
        title="<b>Mapa de Intensidad de Incendios - Ecuador Continental</b>",
        height=500,
        margin=dict(l=0, r=0, t=40, b=0),
        template='plotly_dark'
    )
    
    return fig

def create_fire_timeseries(df):
    """Serie temporal de incendios con análisis estadístico"""
    if df is None or 'fecha' not in df.columns:
        return go.Figure().add_annotation(text="Datos temporales no disponibles", x=0.5, y=0.5)
    
    daily_counts = df.groupby(df['fecha'].dt.date).size().reset_index(name='count')
    daily_counts.columns = ['fecha', 'count']
    
    fig = go.Figure()
    
    # Serie principal
    fig.add_trace(go.Scatter(
        x=daily_counts['fecha'],
        y=daily_counts['count'],
        mode='lines+markers',
        name='Incendios diarios',
        line=dict(color=COLORS['danger'], width=2),
        fill='tonexty',
        hovertemplate='<b>%{x}</b><br>Incendios: %{y}<extra></extra>'
    ))
    
    # Media móvil 7 días
    if len(daily_counts) > 7:
        daily_counts['ma7'] = daily_counts['count'].rolling(window=7, center=True).mean()
        fig.add_trace(go.Scatter(
            x=daily_counts['fecha'],
            y=daily_counts['ma7'],
            mode='lines',
            name='Media móvil (7 días)',
            line=dict(color=COLORS['warning'], width=2, dash='dash'),
            hovertemplate='<b>%{x}</b><br>Promedio 7d: %{y:.1f}<extra></extra>'
        ))
    
    # Línea de tendencia
    if len(daily_counts) > 10:
        from sklearn.linear_model import LinearRegression
        X = np.arange(len(daily_counts)).reshape(-1, 1)
        y = daily_counts['count'].values
        model = LinearRegression()
        model.fit(X, y)
        trend_line = model.predict(X)
        
        fig.add_trace(go.Scatter(
            x=daily_counts['fecha'],
            y=trend_line,
            mode='lines',
            name='Tendencia lineal',
            line=dict(color=COLORS['info'], width=2, dash='dot'),
            hovertemplate='<b>%{x}</b><br>Tendencia: %{y:.1f}<extra></extra>'
        ))
    
    # Estadísticas en anotaciones
    mean_fires = daily_counts['count'].mean()
    max_fires = daily_counts['count'].max()
    
    fig.add_annotation(
        text=f"Promedio: {mean_fires:.1f} | Máximo: {max_fires}",
        xref="paper", yref="paper",
        x=0.02, y=0.98,
        showarrow=False,
        bgcolor=COLORS['bg_secondary'],
        bordercolor=COLORS['primary'],
        borderwidth=1
    )
    
    fig.update_layout(
        title="<b>Evolución Temporal de Incendios con Análisis de Tendencia</b>",
        xaxis_title="Fecha",
        yaxis_title="Número de Incendios",
        height=400,
        template='plotly_dark',
        hovermode='x unified'
    )
    
    return fig

def create_fire_province_chart(df):
    """Top provincias con análisis estadístico"""
    if df is None or 'provincia' not in df.columns:
        return go.Figure().add_annotation(text="Datos de provincia no disponibles", x=0.5, y=0.5)
    
    province_counts = df['provincia'].value_counts().head(10)
    
    # Calcular porcentaje del total
    total_fires = len(df)
    percentages = (province_counts / total_fires * 100).round(1)
    
    fig = go.Figure(data=[go.Bar(
        x=province_counts.values,
        y=province_counts.index,
        orientation='h',
        marker_color=COLORS['danger'],
        text=[f'{count} ({pct}%)' for count, pct in zip(province_counts.values, percentages)],
        textposition='auto',
        hovertemplate='<b>%{y}</b><br>Incendios: %{x}<br>% del total: %{text}<extra></extra>'
    )])
    
    fig.update_layout(
        title="<b>Top 10 Provincias con Más Incendios (% del Total)</b>",
        xaxis_title="Número de Incendios",
        yaxis_title="Provincia",
        height=400,
        template='plotly_dark'
    )
    
    return fig

def create_fire_boxplot(df):
    """Boxplot FRP mejorado con outliers destacados"""
    if df is None or 'frp' not in df.columns:
        return go.Figure().add_annotation(text="Datos FRP no disponibles", x=0.5, y=0.5)
    
    if 'provincia' not in df.columns:
        return go.Figure().add_annotation(text="Datos de provincia no disponibles", x=0.5, y=0.5)
    
    provinces = df['provincia'].value_counts().head(8).index
    df_filtered = df[df['provincia'].isin(provinces)]
    
    fig = go.Figure()
    
    colors = px.colors.qualitative.Set1
    
    for i, province in enumerate(provinces):
        province_data = df_filtered[df_filtered['provincia'] == province]['frp']
        
        fig.add_trace(go.Box(
            y=province_data,
            name=province,
            marker_color=colors[i % len(colors)],
            boxmean='sd',  # Mostrar media y desviación estándar
            hovertemplate='<b>%{fullData.name}</b><br>FRP: %{y:.1f} MW<extra></extra>'
        ))
    
    fig.update_layout(
        title="<b>Distribución de FRP por Provincia (con Media ± SD)</b>",
        xaxis_title="Provincia",
        yaxis_title="FRP (MW)",
        height=400,
        template='plotly_dark',
        showlegend=False
    )
    
    return fig

def create_fire_confidence_pie(df):
    """Distribución de confianza mejorada"""
    if df is None or 'confidence' not in df.columns:
        return go.Figure().add_annotation(text="Datos de confianza no disponibles", x=0.5, y=0.5)
    
    if 'confidence_cat' not in df.columns:
        df = df.copy()
        df['confidence_cat'] = pd.cut(df['confidence'], 
                                    bins=[0, 30, 70, 100], 
                                    labels=['Baja', 'Media', 'Alta'])
    
    confidence_counts = df['confidence_cat'].value_counts()
    total = confidence_counts.sum()
    
    fig = go.Figure(data=[go.Pie(
        labels=confidence_counts.index,
        values=confidence_counts.values,
        hole=0.4,
        marker_colors=[COLORS['danger'], COLORS['warning'], COLORS['success']],
        textinfo='label+percent',
        hovertemplate='<b>%{label}</b><br>Detecciones: %{value}<br>Porcentaje: %{percent}<extra></extra>'
    )])
    
    fig.update_layout(
        title="<b>Distribución por Nivel de Confianza de Detecciones</b>",
        height=400,
        template='plotly_dark',
        annotations=[dict(text=f'Total<br>{total}', x=0.5, y=0.5, font_size=20, showarrow=False)]
    )
    
    return fig

def create_fire_heatmap_monthly(df):
    """Heatmap de incendios por provincia y mes mejorado"""
    if df is None or not all(col in df.columns for col in ['provincia', 'month']):
        return go.Figure().add_annotation(text="Datos de provincia/mes no disponibles", x=0.5, y=0.5)
    
    heatmap_data = pd.crosstab(df['provincia'], df['month'])
    
    # Normalizar por fila para ver patrones estacionales
    heatmap_normalized = heatmap_data.div(heatmap_data.sum(axis=1), axis=0) * 100
    
    month_names = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 
                   'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
    
    fig = go.Figure(data=go.Heatmap(
        z=heatmap_data.values,
        x=[month_names[i-1] for i in heatmap_data.columns],
        y=heatmap_data.index,
        colorscale='Hot',
        showscale=True,
        colorbar=dict(title="Incendios"),
        hovertemplate='<b>%{y}</b><br>Mes: %{x}<br>Incendios: %{z}<extra></extra>'
    ))
    
    fig.update_layout(
        title="<b>Frecuencia Mensual de Incendios por Provincia</b>",
        xaxis_title="Mes",
        yaxis_title="Provincia",
        height=500,
        template='plotly_dark'
    )
    
    return fig

def create_precipitation_timeseries(df):
    """Serie temporal de precipitación mejorada"""
    if df is None or not all(col in df.columns for col in ['fecha', 'precipitation']):
        return go.Figure().add_annotation(text="Datos de precipitación no disponibles", x=0.5, y=0.5)
    
    daily_precip = df.groupby(df['fecha'].dt.date)['precipitation'].agg(['mean', 'sum', 'std']).reset_index()
    
    fig = make_subplots(specs=[[{"secondary_y": True}]])
    
    # Precipitación media diaria
    fig.add_trace(
        go.Scatter(
            x=daily_precip['fecha'],
            y=daily_precip['mean'],
            mode='lines',
            name='Precipitación Media',
            line=dict(color=COLORS['primary'], width=2),
            fill='tonexty',
            hovertemplate='<b>%{x}</b><br>Media: %{y:.3f} mm/hr<extra></extra>'
        ),
        secondary_y=False
    )
    
    # Precipitación acumulada
    fig.add_trace(
        go.Scatter(
            x=daily_precip['fecha'],
            y=daily_precip['sum'],
            mode='lines',
            name='Acumulada Diaria',
            line=dict(color=COLORS['accent_2'], width=2),
            hovertemplate='<b>%{x}</b><br>Acumulada: %{y:.2f} mm/hr<extra></extra>'
        ),
        secondary_y=True
    )
    
    # Media móvil
    if len(daily_precip) > 7:
        daily_precip['ma7'] = daily_precip['mean'].rolling(window=7, center=True).mean()
        fig.add_trace(
            go.Scatter(
                x=daily_precip['fecha'],
                y=daily_precip['ma7'],
                mode='lines',
                name='Media móvil 7d',
                line=dict(color=COLORS['warning'], width=2, dash='dash'),
                hovertemplate='<b>%{x}</b><br>Promedio 7d: %{y:.3f} mm/hr<extra></extra>'
            ),
            secondary_y=False
        )
    
    fig.update_layout(
        title="<b>Evolución Temporal de Precipitación (Análisis Dual)</b>",
        height=400,
        template='plotly_dark',
        hovermode='x unified'
    )
    
    fig.update_yaxes(title_text="Precipitación Media (mm/hr)", secondary_y=False)
    fig.update_yaxes(title_text="Precipitación Acumulada (mm/hr)", secondary_y=True)
    fig.update_xaxes(title_text="Fecha")
    
    return fig

def create_precipitation_boxplot(df):
    """Boxplot de precipitación con estadísticas"""
    if df is None or not all(col in df.columns for col in ['precipitation', 'provincia']):
        return go.Figure().add_annotation(text="Datos de precipitación/provincia no disponibles", x=0.5, y=0.5)
    
    provinces = df['provincia'].value_counts().head(10).index
    df_filtered = df[df['provincia'].isin(provinces)]
    
    fig = go.Figure()
    
    colors = px.colors.qualitative.Set2
    
    for i, province in enumerate(provinces):
        province_data = df_filtered[df_filtered['provincia'] == province]['precipitation']
        
        fig.add_trace(go.Box(
            y=province_data,
            name=province,
            marker_color=colors[i % len(colors)],
            boxmean='sd',
            hovertemplate='<b>%{fullData.name}</b><br>Precipitación: %{y:.3f} mm/hr<extra></extra>'
        ))
    
    fig.update_layout(
        title="<b>Variabilidad de Precipitación por Provincia (con Media ± SD)</b>",
        xaxis_title="Provincia",
        yaxis_title="Precipitación (mm/hr)",
        height=400,
        template='plotly_dark',
        showlegend=False
    )
    
    return fig

def create_precipitation_spatial_heatmap(df):
    """Heatmap espacial de precipitación mejorado"""
    if df is None or not all(col in df.columns for col in ['lat', 'lon', 'precipitation']):
        return go.Figure().add_annotation(text="Datos espaciales de precipitación no disponibles", x=0.5, y=0.5)
    
    if len(df) > 5000:
        df_sample = df.sample(5000)
    else:
        df_sample = df.copy()
    
    fig = go.Figure(data=go.Densitymapbox(
        lat=df_sample['lat'],
        lon=df_sample['lon'],
        z=df_sample['precipitation'],
        radius=25,
        colorscale='Blues',
        showscale=True,
        colorbar=dict(title="Precipitación<br>(mm/hr)"),
        opacity=0.6,
        hovertemplate='<b>Precipitación</b><br>%{z:.3f} mm/hr<extra></extra>'
    ))
    
    fig.update_layout(
        mapbox=dict(
            style="open-street-map",
            center=ECUADOR_CENTER,
            zoom=6
        ),
        title="<b>Heatmap Espacial - Distribución de Precipitación</b>",
        height=500,
        margin=dict(l=0, r=0, t=40, b=0),
        template='plotly_dark'
    )
    
    return fig

def create_precipitation_histogram(df):
    """Histograma de distribución con estadísticas"""
    if df is None or 'precipitation' not in df.columns:
        return go.Figure().add_annotation(text="Datos de precipitación no disponibles", x=0.5, y=0.5)
    
    fig = go.Figure()
    
    fig.add_trace(go.Histogram(
        x=df['precipitation'],
        nbinsx=50,
        marker_color=COLORS['primary'],
        opacity=0.7,
        name='Frecuencia',
        hovertemplate='Rango: %{x}<br>Frecuencia: %{y}<extra></extra>'
    ))
    
    # Añadir líneas de percentiles
    p25 = df['precipitation'].quantile(0.25)
    p50 = df['precipitation'].quantile(0.50)
    p75 = df['precipitation'].quantile(0.75)
    
    for percentile, value, name in [(25, p25, 'Q1'), (50, p50, 'Mediana'), (75, p75, 'Q3')]:
        fig.add_vline(
            x=value,
            line_dash="dash",
            line_color=COLORS['warning'],
            annotation_text=f"{name}: {value:.3f}",
            annotation_position="top"
        )
    
    fig.update_layout(
        title="<b>Distribución de Precipitación con Cuartiles</b>",
        xaxis_title="Precipitación (mm/hr)",
        yaxis_title="Frecuencia",
        height=400,
        template='plotly_dark'
    )
    
    return fig

def create_precipitation_drought_analysis(df):
    """Análisis de sequía mejorado con SPI"""
    if df is None or 'precipitation' not in df.columns:
        return go.Figure().add_annotation(text="Datos de precipitación no disponibles", x=0.5, y=0.5)
    
    if 'drought_category' in df.columns:
        # Usar categorías de sequía basadas en SPI
        drought_counts = df['drought_category'].value_counts().reindex(
            ['Sequía Extrema', 'Sequía Severa', 'Sequía Moderada', 'Normal', 
             'Húmedo Moderado', 'Húmedo Severo', 'Húmedo Extremo'],
            fill_value=0
        )
        
        colors_map = {
            'Sequía Extrema': '#8B0000',
            'Sequía Severa': COLORS['danger'],
            'Sequía Moderada': COLORS['warning'],
            'Normal': COLORS['success'],
            'Húmedo Moderado': COLORS['info'],
            'Húmedo Severo': COLORS['primary'],
            'Húmedo Extremo': '#000080'
        }
        
        fig = go.Figure(data=[go.Bar(
            x=drought_counts.index,
            y=drought_counts.values,
            marker_color=[colors_map[cat] for cat in drought_counts.index],
            text=drought_counts.values,
            textposition='auto',
            hovertemplate='<b>%{x}</b><br>Registros: %{y}<br>%{text}<extra></extra>'
        )])
        
        fig.update_layout(
            title="<b>Análisis de Sequía mediante SPI (Standardized Precipitation Index)</b>",
            xaxis_title="Categoría SPI",
            yaxis_title="Número de Registros",
            height=400,
            template='plotly_dark'
        )
    else:
        # Análisis simple
        daily_precip = df.groupby(df['fecha'].dt.date)['precipitation'].sum().reset_index()
        daily_precip.columns = ['fecha', 'precipitation']
        
        p20 = daily_precip['precipitation'].quantile(0.2)
        p50 = daily_precip['precipitation'].quantile(0.5)
        
        daily_precip['drought_level'] = pd.cut(
            daily_precip['precipitation'],
            bins=[0, p20, p50, float('inf')],
            labels=['Sequía Severa', 'Sequía Moderada', 'Normal/Húmedo']
        )
        
        drought_counts = daily_precip['drought_level'].value_counts()
        
        fig = go.Figure(data=[go.Bar(
            x=drought_counts.index,
            y=drought_counts.values,
            marker_color=[COLORS['danger'], COLORS['warning'], COLORS['primary']],
            text=drought_counts.values,
            textposition='auto',
            hovertemplate='<b>%{x}</b><br>Días: %{y}<extra></extra>'
        )])
        
        fig.update_layout(
            title="<b>Análisis de Condiciones de Sequía (Basado en Percentiles)</b>",
            xaxis_title="Nivel de Sequía",
            yaxis_title="Número de Días",
            height=400,
            template='plotly_dark'
        )
    
    return fig

def create_soil_moisture_timeseries(df):
    """Serie temporal de humedad del suelo mejorada"""
    if df is None or not all(col in df.columns for col in ['fecha', 'soilmoi0_10cm_inst']):
        return go.Figure().add_annotation(text="Datos de humedad del suelo no disponibles", x=0.5, y=0.5)
    
    daily_moisture = df.groupby(df['fecha'].dt.date)['soilmoi0_10cm_inst'].agg(['mean', 'std']).reset_index()
    daily_moisture.columns = ['fecha', 'mean', 'std']
    
    fig = go.Figure()
    
    # Serie principal con banda de confianza
    fig.add_trace(go.Scatter(
        x=daily_moisture['fecha'],
        y=daily_moisture['mean'] + daily_moisture['std'],
        mode='lines',
        line=dict(width=0),
        showlegend=False,
        hoverinfo='skip'
    ))
    
    fig.add_trace(go.Scatter(
        x=daily_moisture['fecha'],
        y=daily_moisture['mean'] - daily_moisture['std'],
        mode='lines',
        line=dict(width=0),
        fillcolor='rgba(0, 200, 150, 0.2)',
        fill='tonexty',
        name='±1 SD',
        hovertemplate='Desv. Est.: ±%{y:.1f}<extra></extra>'
    ))
    
    fig.add_trace(go.Scatter(
        x=daily_moisture['fecha'],
        y=daily_moisture['mean'],
        mode='lines',
        name='Humedad Superficial (0-10cm)',
        line=dict(color=COLORS['success'], width=3),
        hovertemplate='<b>%{x}</b><br>Humedad: %{y:.1f}<extra></extra>'
    ))
    
    # Líneas de referencia
    fig.add_hline(y=150, line_dash="dash", line_color=COLORS['danger'],
                  annotation_text="Umbral Crítico (150)", annotation_position="right")
    fig.add_hline(y=200, line_dash="dot", line_color=COLORS['warning'],
                  annotation_text="Umbral Moderado (200)", annotation_position="right")
    
    # Media móvil
    if len(daily_moisture) > 7:
        daily_moisture['ma7'] = daily_moisture['mean'].rolling(window=7, center=True).mean()
        fig.add_trace(go.Scatter(
            x=daily_moisture['fecha'],
            y=daily_moisture['ma7'],
            mode='lines',
            name='Media móvil 7d',
            line=dict(color=COLORS['warning'], width=2, dash='dash'),
            hovertemplate='<b>%{x}</b><br>Promedio 7d: %{y:.1f}<extra></extra>'
        ))
    
    fig.update_layout(
        title="<b>Evolución de Humedad del Suelo con Umbrales Críticos</b>",
        xaxis_title="Fecha",
        yaxis_title="Humedad del Suelo (0-10cm)",
        height=400,
        template='plotly_dark',
        hovermode='x unified'
    )
    
    return fig

def create_multi_variable_comparison(df):
    """Comparación de múltiples variables climáticas mejorada"""
    if df is None:
        return go.Figure().add_annotation(text="Datos climáticos no disponibles", x=0.5, y=0.5)
    
    vars_to_plot = []
    var_names = []
    var_units = []
    
    if 'soilmoi0_10cm_inst' in df.columns:
        vars_to_plot.append('soilmoi0_10cm_inst')
        var_names.append('Humedad Suelo 0-10cm')
        var_units.append('')
    
    if 'tair_f_inst_c' in df.columns:
        vars_to_plot.append('tair_f_inst_c')
        var_names.append('Temperatura Aire')
        var_units.append('(°C)')
    elif 'tair_f_inst' in df.columns:
        df = df.copy()
        df['tair_f_inst_c'] = df['tair_f_inst'] - 273.15
        vars_to_plot.append('tair_f_inst_c')
        var_names.append('Temperatura Aire')
        var_units.append('(°C)')
    
    if 'rainf_tavg' in df.columns:
        vars_to_plot.append('rainf_tavg')
        var_names.append('Precipitación Promedio')
        var_units.append('')
    
    if len(vars_to_plot) == 0:
        return go.Figure().add_annotation(text="Variables climáticas no disponibles", x=0.5, y=0.5)
    
    fig = make_subplots(
        rows=len(vars_to_plot), cols=1,
        subplot_titles=[f"{name} {unit}" for name, unit in zip(var_names, var_units)],
        vertical_spacing=0.08
    )
    
    colors = [COLORS['success'], COLORS['warning'], COLORS['primary'], COLORS['info']]
   
    for i, var in enumerate(vars_to_plot):
        daily_data = df.groupby(df['fecha'].dt.date)[var].agg(['mean', 'std']).reset_index()
        
        # Banda de confianza
        fig.add_trace(
            go.Scatter(
                x=daily_data['fecha'],
                y=daily_data['mean'] + daily_data['std'],
                mode='lines',
                line=dict(width=0),
                showlegend=False,
                hoverinfo='skip'
            ),
            row=i+1, col=1
        )
        
        fig.add_trace(
            go.Scatter(
                x=daily_data['fecha'],
                y=daily_data['mean'] - daily_data['std'],
                mode='lines',
                line=dict(width=0),
                fillcolor=f'rgba({int(colors[i % len(colors)][1:3], 16)}, {int(colors[i % len(colors)][3:5], 16)}, {int(colors[i % len(colors)][5:7], 16)}, 0.2)',
                fill='tonexty',
                showlegend=False,
                hoverinfo='skip'
            ),
            row=i+1, col=1
        )
        
        fig.add_trace(
            go.Scatter(
                x=daily_data['fecha'],
                y=daily_data['mean'],
                mode='lines',
                name=var_names[i],
                line=dict(color=colors[i % len(colors)], width=2),
                hovertemplate=f'<b>%{{x}}</b><br>{var_names[i]}: %{{y:.2f}}<extra></extra>'
            ),
            row=i+1, col=1
        )
    
    fig.update_layout(
        title="<b>Análisis Multi-Variable del Sistema Climático</b>",
        height=600,
        showlegend=False,
        template='plotly_dark',
        hovermode='x unified'
    )
    
    return fig

def create_soil_spatial_heatmap(df):
    """Heatmap espacial de humedad del suelo mejorado"""
    if df is None or not all(col in df.columns for col in ['lat', 'lon', 'soilmoi0_10cm_inst']):
        return go.Figure().add_annotation(text="Datos espaciales de humedad no disponibles", x=0.5, y=0.5)
    
    if len(df) > 5000:
        df_sample = df.sample(5000)
    else:
        df_sample = df.copy()
    
    fig = go.Figure(data=go.Densitymapbox(
        lat=df_sample['lat'],
        lon=df_sample['lon'],
        z=df_sample['soilmoi0_10cm_inst'],
        radius=30,
        colorscale='YlOrBr_r',
        showscale=True,
        colorbar=dict(title="Humedad<br>del Suelo"),
        opacity=0.6,
        hovertemplate='<b>Humedad del Suelo</b><br>%{z:.1f}<extra></extra>'
    ))
    
    fig.update_layout(
        mapbox=dict(
            style="open-street-map",
            center=ECUADOR_CENTER,
            zoom=6
        ),
        title="<b>Heatmap Espacial - Distribución de Humedad del Suelo</b>",
        height=500,
        margin=dict(l=0, r=0, t=40, b=0),
        template='plotly_dark'
    )
    
    return fig

def create_soil_fire_correlation(gldas_df, fire_df):
    """Análisis de correlación mejorado con regresión"""
    if gldas_df is None or fire_df is None:
        return go.Figure().add_annotation(text="Datos insuficientes para correlación", x=0.5, y=0.5)
    
    if 'soilmoi0_10cm_inst' not in gldas_df.columns:
        return go.Figure().add_annotation(text="Datos de humedad del suelo no disponibles", x=0.5, y=0.5)
    
    soil_monthly = gldas_df.groupby(['year', 'month', 'provincia'])['soilmoi0_10cm_inst'].mean().reset_index()
    fire_monthly = fire_df.groupby(['year', 'month', 'provincia']).size().reset_index(name='fire_count')
    
    merged = pd.merge(soil_monthly, fire_monthly, on=['year', 'month', 'provincia'], how='inner')
    merged = merged[merged['provincia'] != 'NO_IDENTIFICADO']
    
    if len(merged) == 0:
        return go.Figure().add_annotation(text="Sin datos para correlación", x=0.5, y=0.5)
    
    fig = go.Figure()
    
    # Scatter plot principal
    fig.add_trace(go.Scatter(
        x=merged['soilmoi0_10cm_inst'],
        y=merged['fire_count'],
        mode='markers',
        marker=dict(
            size=10,
            color=merged['month'],
            colorscale='Viridis',
            showscale=True,
            colorbar=dict(title="Mes"),
            line=dict(width=1, color='white')
        ),
        text=[f"<b>{p}</b><br>Mes: {m}<br>Humedad: {h:.1f}<br>Incendios: {f}" 
              for p, m, h, f in zip(merged['provincia'], merged['month'], 
                                   merged['soilmoi0_10cm_inst'], merged['fire_count'])],
        hovertemplate='%{text}<extra></extra>',
        name='Datos observados'
    ))
    
    # Línea de regresión
    if len(merged) > 3:
        from sklearn.linear_model import LinearRegression
        X = merged['soilmoi0_10cm_inst'].values.reshape(-1, 1)
        y = merged['fire_count'].values
        model = LinearRegression()
        model.fit(X, y)
        
        X_range = np.linspace(X.min(), X.max(), 100).reshape(-1, 1)
        y_pred = model.predict(X_range)
        
        fig.add_trace(go.Scatter(
            x=X_range.flatten(),
            y=y_pred,
            mode='lines',
            name=f'Regresión (R²={model.score(X, y):.3f})',
            line=dict(color=COLORS['danger'], width=3, dash='dash'),
            hovertemplate='Predicción: %{y:.1f}<extra></extra>'
        ))
        
        # Calcular correlación
        correlation, p_value = stats.pearsonr(merged['soilmoi0_10cm_inst'], merged['fire_count'])
        
        fig.add_annotation(
            text=f"<b>Correlación de Pearson</b><br>r = {correlation:.3f}<br>p = {p_value:.4f}<br>{'Significativo' if p_value < 0.05 else 'No significativo'}",
            xref="paper", yref="paper",
            x=0.02, y=0.98,
            showarrow=False,
            bgcolor=COLORS['bg_secondary'],
            bordercolor=COLORS['primary'],
            borderwidth=2,
            align='left'
        )
    
    fig.update_layout(
        title="<b>Correlación: Humedad del Suelo vs Frecuencia de Incendios</b>",
        xaxis_title="Humedad del Suelo (0-10cm)",
        yaxis_title="Número de Incendios por Mes",
        height=400,
        template='plotly_dark'
    )
    
    return fig

# =============================================================================
# COMPONENTES INTERACTIVOS CON INSIGHTS
# =============================================================================
def create_insight_card(insight_text, icon="bi-lightbulb-fill", color=COLORS['primary']):
    """Crear tarjeta de insight/recomendación mejorada"""
    return dbc.Card([
        dbc.CardBody([
            html.Div([
                html.I(className=f"bi {icon} me-2", style={'color': color, 'fontSize': '1.5rem'}),
                html.Strong("Análisis Inteligente y Recomendaciones", style={'color': color, 'fontSize': '1.1rem'})
            ], className="mb-3"),
            dcc.Markdown(insight_text, className="small", style={'color': COLORS['text_primary'], 'lineHeight': '1.6'})
        ])
    ], style={'backgroundColor': f"{color}15", 'border': f'2px solid {color}', 'borderRadius': '10px'}, className="mt-3 shadow")

def create_filter_panel(dataset_type):
    """Crear panel de filtros interactivos con cascada"""
    if dataset_type == 'fire':
        df = fire_df
        specific_filters = [
            html.Div([
                html.Label("Confianza de Detección:", className="fw-bold mb-2"),
                dcc.RangeSlider(
                    id='confidence-slider',
                    min=0, max=100, step=10,
                    marks={i: f'{i}%' for i in range(0, 101, 20)},
                    value=[0, 100],
                    tooltip={"placement": "bottom", "always_visible": True}
                )
            ], className="mb-3"),
            html.Div([
                html.Label("FRP - Potencia Radiativa (MW):", className="fw-bold mb-2"),
                dcc.RangeSlider(
                    id='frp-slider',
                    min=0, max=200, step=10,
                    marks={i: f'{i}' for i in range(0, 201, 50)},
                    value=[0, 200],
                    tooltip={"placement": "bottom", "always_visible": True}
                )
            ], className="mb-3")
        ]
    elif dataset_type == 'precipitation':
        df = gpm_df
        specific_filters = [
            html.Div([
                html.Label("Precipitación (mm/hr):", className="fw-bold mb-2"),
                dcc.RangeSlider(
                    id='precip-slider',
                    min=0, max=1, step=0.05,
                    marks={i/10: f'{i/10:.1f}' for i in range(0, 11, 2)},
                    value=[0, 1],
                    tooltip={"placement": "bottom", "always_visible": True}
                )
            ], className="mb-3")
        ]
    else:  # soil-climate
        df = gldas_df
        specific_filters = [
            html.Div([
                html.Label("Humedad del Suelo (0-10cm):", className="fw-bold mb-2"),
                dcc.RangeSlider(
                    id='moisture-slider',
                    min=0, max=500, step=25,
                    marks={i: f'{i}' for i in range(0, 501, 100)},
                    value=[0, 500],
                    tooltip={"placement": "bottom", "always_visible": True}
                )
            ], className="mb-3")
        ]
    
    if df is None:
        return html.Div("No hay datos disponibles", className="text-light")
    
    # Filtros comunes
    provinces = get_unique_values(df, 'provincia')
    min_date, max_date = get_date_range(df)
    
    return dbc.Card([
        dbc.CardHeader([
            html.I(className="bi bi-funnel-fill me-2", style={'fontSize': '1.2rem'}),
            html.Strong("FILTROS INTERACTIVOS", style={'fontSize': '1.1rem'})
        ], style={'backgroundColor': COLORS['bg_secondary']}),
        dbc.CardBody([
            # Filtro de fechas
            html.Div([
                html.Label("Rango de Fechas:", className="fw-bold mb-2"),
                dcc.DatePickerRange(
                    id=f'{dataset_type}-date-picker',
                    start_date=min_date,
                    end_date=max_date,
                    display_format='DD/MM/YYYY',
                    style={'width': '100%'}
                )
            ], className="mb-3"),
            
            # Filtro de provincia
            html.Div([
                html.Label("Provincia:", className="fw-bold mb-2"),
                dcc.Dropdown(
                    id=f'{dataset_type}-province-dropdown',
                    options=[{'label': 'Todas las Provincias', 'value': 'all'}] + 
                           [{'label': prov, 'value': prov} for prov in provinces],
                    value='all',
                    clearable=False,
                    style={'color': 'black'}
                )
            ], className="mb-3"),
            
            # Filtro de cantón
            html.Div([
                html.Label("Cantón:", className="fw-bold mb-2"),
                dcc.Dropdown(
                    id=f'{dataset_type}-canton-dropdown',
                    options=[{'label': 'Todos los Cantones', 'value': 'all'}],
                    value='all',
                    clearable=False,
                    style={'color': 'black'}
                )
            ], className="mb-3"),
            
            # Filtros específicos
            *specific_filters,
            
            # Botón de reset
            dbc.Button(
                [html.I(className="bi bi-arrow-counterclockwise me-2"), "Resetear Filtros"],
                id=f'{dataset_type}-reset-filters',
                color="warning",
                size="sm",
                className="w-100 mt-3"
            )
        ])
    ], className="mb-4", style={'backgroundColor': COLORS['bg_card'], 'borderRadius': '10px'})

def create_stats_cards(df, dataset_type, insights=None):
    """Crear tarjetas de estadísticas mejoradas"""
    if df is None:
        return html.Div()
    
    if dataset_type == 'fire':
        # Calcular estadísticas avanzadas
        total_fires = len(df)
        avg_frp = df['frp'].mean() if 'frp' in df.columns else 0
        max_frp = df['frp'].max() if 'frp' in df.columns else 0
        high_conf_pct = (df['confidence'] > 70).sum() / len(df) * 100 if 'confidence' in df.columns else 0
        
        cards = [
            create_stat_card("Total Incendios", f"{total_fires:,}", "bi-fire", COLORS['danger'],
                           subtitle=f"en {df['provincia'].nunique()} provincias"),
            create_stat_card("FRP Promedio", f"{avg_frp:.1f} MW", "bi-thermometer-high", COLORS['warning'],
                           subtitle=f"Máximo: {max_frp:.1f} MW"),
            create_stat_card("Alta Confianza", f"{high_conf_pct:.0f}%", "bi-shield-check", COLORS['success'],
                           subtitle="detecciones >70%"),
            create_stat_card("Provincias Afectadas", f"{df['provincia'].nunique()}", "bi-geo-alt", COLORS['info'],
                           subtitle=f"de 24 totales")
        ]
    elif dataset_type == 'precipitation':
        avg_precip = df['precipitation'].mean() if 'precipitation' in df.columns else 0
        max_precip = df['precipitation'].max() if 'precipitation' in df.columns else 0
        rainy_days = (df['precipitation'] > 0.001).sum() if 'precipitation' in df.columns else 0
        
        cards = [
            create_stat_card("Mediciones", f"{len(df):,}", "bi-droplet", COLORS['primary'],
                           subtitle="registros totales"),
            create_stat_card("Precipitación Media", f"{avg_precip:.3f} mm/hr", "bi-cloud-rain", COLORS['info'],
                           subtitle=f"Máxima: {max_precip:.3f}"),
            create_stat_card("Registros con Lluvia", f"{rainy_days:,}", "bi-calendar-check", COLORS['success'],
                           subtitle=f"{(rainy_days/len(df)*100):.1f}% del total"),
            create_stat_card("Cobertura Provincial", f"{df['provincia'].nunique()}", "bi-map", COLORS['accent_2'],
                           subtitle="provincias monitoreadas")
        ]
    else:  # soil-climate
        avg_moisture = df['soilmoi0_10cm_inst'].mean() if 'soilmoi0_10cm_inst' in df.columns else 0
        avg_temp = df['tair_f_inst_c'].mean() if 'tair_f_inst_c' in df.columns else 0
        num_vars = len([col for col in df.columns if col not in ['lat', 'lon', 'fecha', 'provincia', 'canton']])
        
        cards = [
            create_stat_card("Registros Climáticos", f"{len(df):,}", "bi-graph-up", COLORS['success'],
                           subtitle="mediciones totales"),
            create_stat_card("Humedad Media", f"{avg_moisture:.1f}", "bi-moisture", COLORS['info'],
                           subtitle="nivel superficial 0-10cm"),
            create_stat_card("Temperatura", f"{avg_temp:.1f}°C", "bi-thermometer-half", COLORS['warning'],
                           subtitle="promedio del aire"),
            create_stat_card("Variables", f"{num_vars}", "bi-list-ul", COLORS['primary'],
                           subtitle="parámetros monitoreados")
        ]
    
    return dbc.Row([
        dbc.Col(card, md=3, className="mb-3") for card in cards
    ])

def create_stat_card(title, value, icon, color, subtitle=""):
    """Crear tarjeta de estadística individual mejorada"""
    return dbc.Card([
        dbc.CardBody([
            html.Div([
                html.I(className=f"bi {icon}", style={'fontSize': '2.5rem', 'color': color}),
                html.H3(value, className="mt-3 mb-0", style={'color': color, 'fontWeight': 'bold'}),
                html.P(title, className="text-light mb-1", style={'fontSize': '0.9rem'}),
                html.Small(subtitle, className="text-muted")
            ], className="text-center")
        ])
    ], style={'backgroundColor': COLORS['bg_card'], 'border': f'2px solid {color}40', 'borderRadius': '10px'}, className="h-100 shadow")

# =============================================================================
# COMPONENTE DE ASISTENTE VIRTUAL MEJORADO
# =============================================================================
def create_chatbot_component():
    """Crear el componente del asistente virtual mejorado"""
    return html.Div([
        # Botón flotante
        dbc.Button(
            [html.I(className="bi bi-chat-dots-fill me-2"), "Asistente IA NASA"],
            id="chat-toggle-button",
            color="primary",
            className="shadow-lg",
            style={
                'position': 'fixed',
                'bottom': '20px',
                'right': '20px',
                'zIndex': '1000',
                'borderRadius': '30px',
                'padding': '12px 24px',
                'fontSize': '1.1rem',
                'fontWeight': 'bold'
            }
        ),
        
        # Ventana de chat
        dbc.Offcanvas(
            [
                # Header
                html.Div([
                    html.Div([
                        html.I(className="bi bi-robot", style={'fontSize': '2.5rem', 'color': COLORS['primary']}),
                        html.Div([
                            html.H4("Asistente NASA Ecuador", className="mb-0"),
                            html.Small("Análisis Inteligente 24/7 con IA", className="text-muted")
                        ], className="ms-3")
                    ], className="d-flex align-items-center")
                ], className="border-bottom pb-3 mb-3"),
                
                # Área de mensajes
                html.Div([
                    html.Div([
                        html.Div([
                            html.Div([
                                html.I(className="bi bi-robot me-2"),
                                "Asistente NASA"
                            ], className="text-primary small mb-1"),
                            html.Div([
                                dcc.Markdown("""
**Bienvenido al Sistema de Análisis NASA Ecuador**

Soy tu asistente de inteligencia artificial especializado en análisis de datos satelitales. Puedo ayudarte con:

- **Interpretación Estadística**: Análisis profundo de tendencias, correlaciones y patrones
- **Evaluación de Riesgo**: Identificación de alertas críticas y áreas prioritarias
- **Recomendaciones Accionables**: Estrategias basadas en datos para toma de decisiones
- **Análisis Predictivo**: Proyecciones y escenarios futuros
- **Contexto Técnico**: Explicación de métricas (FRP, SPI, índices climáticos)

¿Qué análisis necesitas hoy?
                                """)
                            ], className="p-3 rounded", 
                            style={'backgroundColor': f"{COLORS['primary']}20", 'border': f"2px solid {COLORS['primary']}60"})
                        ], className="mb-3")
                    ], id="chat-messages", style={'maxHeight': '450px', 'overflowY': 'auto', 'overflowX': 'hidden'}),
                    
                    # Sugerencias rápidas
                    html.Div([
                        html.P("Consultas sugeridas:", className="small text-muted mb-2 fw-bold"),
                        html.Div([
                            dbc.Button([html.I(className="bi bi-bar-chart me-1"), "Análisis actual"], 
                                     id="quick-1", size="sm", color="outline-primary", className="me-2 mb-2"),
                            dbc.Button([html.I(className="bi bi-exclamation-triangle me-1"), "Alertas críticas"], 
                                     id="quick-2", size="sm", color="outline-danger", className="me-2 mb-2"),
                            dbc.Button([html.I(className="bi bi-graph-up me-1"), "Interpretar gráfico"], 
                                     id="quick-3", size="sm", color="outline-info", className="me-2 mb-2"),
                            dbc.Button([html.I(className="bi bi-lightbulb me-1"), "Recomendaciones"], 
                                     id="quick-4", size="sm", color="outline-success", className="mb-2"),
                        ])
                    ], className="border-top pt-3 mt-3")
                ], className="flex-grow-1"),
                
                # Input
                html.Div([
                    dbc.InputGroup([
                        dbc.Input(
                            placeholder="Escribe tu pregunta técnica aquí...",
                            id="chat-input",
                            type="text"
                        ),
                        dbc.Button(
                            html.I(className="bi bi-send-fill"),
                            id="chat-send-button",
                            color="primary"
                        )
                    ])
                ], className="mt-3")
            ],
            id="chat-offcanvas",
            title="",
            is_open=False,
            placement="end",
            style={'width': '450px'}
        )
    ])

# =============================================================================
# FUNCIONES DEL ASISTENTE VIRTUAL MEJORADAS
# =============================================================================
def process_user_query(query, current_page, current_filters):
    """Procesar consultas con análisis profundo"""
    query_lower = query.lower()
    response = {}
    
    # Detectar tipo de consulta con mayor precisión
    if any(word in query_lower for word in ['situación', 'actual', 'estado', 'resumen', 'análisis']):
        response = generate_situation_report(current_page, current_filters)
    
    elif any(word in query_lower for word in ['alerta', 'crítico', 'emergencia', 'peligro', 'riesgo']):
        response = generate_alerts_report()
    
    elif any(word in query_lower for word in ['explicar', 'qué significa', 'interpretar', 'entender', 'gráfico']):
        response = explain_current_view(current_page)
    
    elif any(word in query_lower for word in ['recomendar', 'sugerir', 'qué hacer', 'acción', 'medida']):
        response = generate_recommendations(current_page)
    
    elif any(word in query_lower for word in ['provincia', 'cantón', 'región', 'zona', 'lugar']):
        response = analyze_geographic_query(query, current_filters)
    
    elif any(word in query_lower for word in ['tendencia', 'predicción', 'futuro', 'proyección', 'pronóstico']):
        response = generate_trend_analysis(current_page)
    
    elif any(word in query_lower for word in ['estadística', 'correlación', 'percentil', 'desviación', 'significancia']):
        response = generate_statistical_analysis(current_page)
    
    elif any(word in query_lower for word in ['ayuda', 'cómo', 'usar', 'navegar', 'funciona']):
        response = provide_navigation_help()
    
    else:
        response = generate_contextual_response(query, current_page)
    
    return response

def generate_situation_report(current_page, current_filters):
    """Generar reporte de situación con análisis estadístico"""
    report = {
        'type': 'situation',
        'title': 'Reporte de Situación Actual con Análisis Estadístico',
        'content': []
    }
    
    if current_page == '/incendios' and fire_df is not None:
        stats = calculate_statistical_summary(fire_df, 'frp' if 'frp' in fire_df.columns else 'confidence')
        trend = calculate_trend(fire_df, 'fecha', 'frp' if 'frp' in fire_df.columns else 'confidence')
        
        report['content'].append("### INCENDIOS FORESTALES - ANÁLISIS INTEGRAL\n")
        report['content'].append(f"**Registros totales**: {len(fire_df):,} detecciones satelitales\n")
        
        if stats:
            report['content'].append(f"\n**Estadísticas FRP**:")
            report['content'].append(f"- Media: {stats['mean']:.2f} MW (±{stats['std']:.2f})")
            report['content'].append(f"- Mediana: {stats['median']:.2f} MW")
            report['content'].append(f"- Rango: {stats['min']:.2f} - {stats['max']:.2f} MW")
            report['content'].append(f"- Coeficiente de Variación: {stats['cv']:.1f}%")
            report['content'].append(f"- Asimetría: {stats['skewness']:.2f} {'(distribución sesgada a la derecha)' if stats['skewness'] > 0.5 else ''}")
        
        if trend and trend['significant']:
            report['content'].append(f"\n**Tendencia Temporal** (R²={trend['r_squared']:.3f}, p={trend['p_value']:.4f}):")
            report['content'].append(f"- Dirección: {'ASCENDENTE' if trend['direction'] == 'increasing' else 'DESCENDENTE'}")
            report['content'].append(f"- Significancia: {'**ESTADÍSTICAMENTE SIGNIFICATIVA**' if trend['p_value'] < 0.01 else 'Significativa'}")
        
       # Análisis de alertas
        if 'frp' in fire_df.columns:
            critical_fires = fire_df[fire_df['frp'] > fire_df['frp'].quantile(0.90)]
            report['content'].append(f"\n**Eventos Críticos** (percentil 90):")
            report['content'].append(f"- {len(critical_fires)} incendios de alta intensidad (>{fire_df['frp'].quantile(0.90):.1f} MW)")
            
            if len(critical_fires) > 0 and 'provincia' in critical_fires.columns:
                top_critical = critical_fires['provincia'].value_counts().head(3)
                report['content'].append(f"- Provincias más afectadas: {', '.join(top_critical.index.tolist())}")
    
    elif current_page == '/precipitacion' and gpm_df is not None:
        stats = calculate_statistical_summary(gpm_df, 'precipitation')
        
        report['content'].append("### PRECIPITACIÓN - ANÁLISIS HIDROLÓGICO\n")
        report['content'].append(f"**Registros totales**: {len(gpm_df):,} mediciones satelitales GPM\n")
        
        if stats:
            report['content'].append(f"\n**Estadísticas de Precipitación**:")
            report['content'].append(f"- Media: {stats['mean']:.4f} mm/hr")
            report['content'].append(f"- Mediana: {stats['median']:.4f} mm/hr")
            report['content'].append(f"- Desviación estándar: {stats['std']:.4f}")
            report['content'].append(f"- CV: {stats['cv']:.1f}% {'(alta variabilidad)' if stats['cv'] > 100 else ''}")
        
        if 'spi' in gpm_df.columns:
            drought_analysis = gpm_df['drought_category'].value_counts()
            report['content'].append(f"\n**Índice SPI (Standardized Precipitation Index)**:")
            for category, count in drought_analysis.head(5).items():
                pct = (count / len(gpm_df)) * 100
                report['content'].append(f"- {category}: {count:,} registros ({pct:.1f}%)")
    
    elif current_page == '/suelo-clima' and gldas_df is not None:
        moisture_stats = calculate_statistical_summary(gldas_df, 'soilmoi0_10cm_inst') if 'soilmoi0_10cm_inst' in gldas_df.columns else None
        temp_stats = calculate_statistical_summary(gldas_df, 'tair_f_inst_c') if 'tair_f_inst_c' in gldas_df.columns else None
        
        report['content'].append("### SUELO Y CLIMA - ANÁLISIS AMBIENTAL\n")
        report['content'].append(f"**Registros totales**: {len(gldas_df):,} mediciones GLDAS\n")
        
        if moisture_stats:
            report['content'].append(f"\n**Humedad del Suelo (0-10cm)**:")
            report['content'].append(f"- Media: {moisture_stats['mean']:.1f}")
            report['content'].append(f"- Percentil 25: {moisture_stats['q25']:.1f}")
            report['content'].append(f"- Percentil 75: {moisture_stats['q75']:.1f}")
            
            critical_level = 150
            pct_critical = (gldas_df['soilmoi0_10cm_inst'] < critical_level).sum() / len(gldas_df) * 100
            report['content'].append(f"- **{pct_critical:.1f}% de registros en nivel crítico (<{critical_level})**")
        
        if temp_stats:
            report['content'].append(f"\n**Temperatura del Aire**:")
            report['content'].append(f"- Media: {temp_stats['mean']:.1f}°C")
            report['content'].append(f"- Rango: {temp_stats['min']:.1f}°C - {temp_stats['max']:.1f}°C")
    
    if not report['content']:
        report['content'].append("Navegue a una sección específica (Incendios, Precipitación o Suelo & Clima) para análisis detallado.")
    
    return report

def generate_alerts_report():
    """Generar reporte de alertas con priorización"""
    alerts = {
        'type': 'alerts',
        'title': 'Sistema de Alertas Prioritarias',
        'content': []
    }
    
    critical_alerts = []
    warning_alerts = []
    info_alerts = []
    
    # ANÁLISIS DE INCENDIOS
    if fire_df is not None and len(fire_df) > 0:
        recent = fire_df[fire_df['fecha'] >= pd.Timestamp.now() - pd.Timedelta(days=7)]
        prev_week = fire_df[(fire_df['fecha'] >= pd.Timestamp.now() - pd.Timedelta(days=14)) & 
                           (fire_df['fecha'] < pd.Timestamp.now() - pd.Timedelta(days=7))]
        
        fire_increase = len(recent) / max(len(prev_week), 1)
        
        if fire_increase > 2:
            critical_alerts.append({
                'priority': 'CRÍTICO',
                'category': 'Incendios',
                'message': f"Incremento crítico de {((fire_increase-1)*100):.0f}% en incendios (última semana vs anterior)",
                'action': "Activar protocolo de emergencia nivel 1. Movilizar todos los recursos disponibles.",
                'metric': f"Incendios actuales: {len(recent)}, previos: {len(prev_week)}"
            })
        elif fire_increase > 1.3:
            warning_alerts.append({
                'priority': 'ADVERTENCIA',
                'category': 'Incendios',
                'message': f"Incremento moderado de {((fire_increase-1)*100):.0f}% en incendios",
                'action': "Aumentar vigilancia. Preparar recursos adicionales.",
                'metric': f"Tendencia ascendente confirmada"
            })
        
        if 'frp' in fire_df.columns:
            high_frp = fire_df[fire_df['frp'] > 100]
            if len(high_frp) > 0:
                critical_alerts.append({
                    'priority': 'CRÍTICO',
                    'category': 'Incendios de Alta Intensidad',
                    'message': f"{len(high_frp)} incendios con FRP >100 MW detectados",
                    'action': "Desplegar equipos aéreos. Evaluar riesgo para poblaciones cercanas.",
                    'metric': f"FRP máximo: {fire_df['frp'].max():.1f} MW"
                })
    
    # ANÁLISIS DE SEQUÍA
    if gpm_df is not None and 'precipitation' in gpm_df.columns:
        recent_precip = gpm_df[gpm_df['fecha'] >= pd.Timestamp.now() - pd.Timedelta(days=30)]
        
        if len(recent_precip) > 0:
            avg_precip = recent_precip['precipitation'].mean()
            historical_avg = gpm_df['precipitation'].mean()
            
            deficit = ((historical_avg - avg_precip) / historical_avg) * 100
            
            if deficit > 70:
                critical_alerts.append({
                    'priority': 'CRÍTICO',
                    'category': 'Sequía Severa',
                    'message': f"Precipitación {deficit:.0f}% bajo promedio histórico (últimos 30 días)",
                    'action': "Declarar emergencia hídrica. Implementar restricciones inmediatas.",
                    'metric': f"Precipitación actual: {avg_precip:.4f} mm/hr vs histórico: {historical_avg:.4f} mm/hr"
                })
            elif deficit > 40:
                warning_alerts.append({
                    'priority': 'ADVERTENCIA',
                    'category': 'Déficit Hídrico',
                    'message': f"Precipitación {deficit:.0f}% bajo promedio",
                    'action': "Activar campañas de ahorro de agua. Monitorear reservorios.",
                    'metric': f"Déficit confirmado estadísticamente"
                })
    
    # ANÁLISIS DE HUMEDAD DEL SUELO
    if gldas_df is not None and 'soilmoi0_10cm_inst' in gldas_df.columns:
        recent_moisture = gldas_df[gldas_df['fecha'] >= pd.Timestamp.now() - pd.Timedelta(days=30)]
        
        if len(recent_moisture) > 0:
            avg_moisture = recent_moisture['soilmoi0_10cm_inst'].mean()
            
            if avg_moisture < 100:
                critical_alerts.append({
                    'priority': 'CRÍTICO',
                    'category': 'Estrés Hídrico Extremo',
                    'message': f"Humedad del suelo en nivel crítico: {avg_moisture:.1f}",
                    'action': "Activar riego de emergencia. Alto riesgo de incendios y pérdida de cultivos.",
                    'metric': f"Por debajo del punto de marchitez permanente"
                })
            elif avg_moisture < 150:
                warning_alerts.append({
                    'priority': 'ADVERTENCIA',
                    'category': 'Estrés Hídrico',
                    'message': f"Humedad del suelo baja: {avg_moisture:.1f}",
                    'action': "Iniciar riego suplementario. Monitoreo diario requerido.",
                    'metric': f"Umbral crítico: 150"
                })
    
    # Construir reporte priorizado
    alerts['content'].append("## ALERTAS ACTIVAS POR PRIORIDAD\n")
    
    if critical_alerts:
        alerts['content'].append("\n### 🚨 CRÍTICO - ACCIÓN INMEDIATA REQUERIDA\n")
        for alert in critical_alerts:
            alerts['content'].append(f"\n**[{alert['category']}]**")
            alerts['content'].append(f"- **Situación**: {alert['message']}")
            alerts['content'].append(f"- **Acción**: {alert['action']}")
            alerts['content'].append(f"- **Métrica**: {alert['metric']}\n")
    
    if warning_alerts:
        alerts['content'].append("\n### ⚠️ ADVERTENCIA - MONITOREO ACTIVO\n")
        for alert in warning_alerts:
            alerts['content'].append(f"\n**[{alert['category']}]**")
            alerts['content'].append(f"- **Situación**: {alert['message']}")
            alerts['content'].append(f"- **Acción**: {alert['action']}")
            alerts['content'].append(f"- **Métrica**: {alert['metric']}\n")
    
    if not critical_alerts and not warning_alerts:
        alerts['content'].append("\n✅ **No hay alertas críticas o de advertencia activas en este momento.**\n")
        alerts['content'].append("\nSistema en condiciones normales de operación. Mantener monitoreo rutinario.")
    
    return alerts

def generate_statistical_analysis(current_page):
    """Generar análisis estadístico profundo"""
    analysis = {
        'type': 'statistical',
        'title': 'Análisis Estadístico Avanzado',
        'content': []
    }
    
    if current_page == '/incendios' and fire_df is not None:
        if 'frp' in fire_df.columns:
            stats = calculate_statistical_summary(fire_df, 'frp')
            outliers = detect_outliers(fire_df, 'frp', method='all')
            
            analysis['content'].append("## ANÁLISIS ESTADÍSTICO - INCENDIOS\n")
            analysis['content'].append("\n### Estadística Descriptiva\n")
            analysis['content'].append(f"- **N**: {stats['count']:,} observaciones")
            analysis['content'].append(f"- **Media**: {stats['mean']:.2f} MW")
            analysis['content'].append(f"- **Mediana**: {stats['median']:.2f} MW")
            analysis['content'].append(f"- **Desviación Estándar**: {stats['std']:.2f} MW")
            analysis['content'].append(f"- **Rango Intercuartílico (IQR)**: {stats['iqr']:.2f} MW")
            
            analysis['content'].append("\n### Distribución\n")
            analysis['content'].append(f"- **Asimetría (Skewness)**: {stats['skewness']:.3f}")
            if stats['skewness'] > 1:
                analysis['content'].append("  - Interpretación: Distribución fuertemente sesgada a la derecha. Predominan incendios de baja intensidad con eventos extremos ocasionales.")
            elif stats['skewness'] > 0.5:
                analysis['content'].append("  - Interpretación: Distribución moderadamente asimétrica. Más incendios pequeños que grandes.")
            
            analysis['content'].append(f"- **Curtosis**: {stats['kurtosis']:.3f}")
            if stats['kurtosis'] > 0:
                analysis['content'].append("  - Interpretación: Distribución leptocúrtica (colas pesadas). Mayor probabilidad de eventos extremos.")
            
            if 'is_normal' in stats:
                analysis['content'].append(f"\n### Test de Normalidad (Shapiro-Wilk)\n")
                analysis['content'].append(f"- **p-value**: {stats['normality_p']:.4f}")
                analysis['content'].append(f"- **Resultado**: {'Los datos NO siguen distribución normal' if not stats['is_normal'] else 'Los datos siguen distribución normal'}")
                analysis['content'].append("  - Implicación: Use estadísticas no paramétricas para inferencias.")
            
            if outliers:
                analysis['content'].append("\n### Detección de Outliers\n")
                if 'iqr' in outliers:
                    analysis['content'].append(f"- **Método IQR**: {outliers['iqr']['count']} outliers ({outliers['iqr']['percentage']:.2f}%)")
                    analysis['content'].append(f"  - Límites: [{outliers['iqr']['lower']:.2f}, {outliers['iqr']['upper']:.2f}] MW")
                if 'zscore' in outliers:
                    analysis['content'].append(f"- **Método Z-score**: {outliers['zscore']['count']} outliers ({outliers['zscore']['percentage']:.2f}%)")
    
    elif current_page == '/precipitacion' and gpm_df is not None:
        if 'precipitation' in gpm_df.columns:
            stats = calculate_statistical_summary(gpm_df, 'precipitation')
            
            analysis['content'].append("## ANÁLISIS ESTADÍSTICO - PRECIPITACIÓN\n")
            analysis['content'].append("\n### Estadística Descriptiva\n")
            analysis['content'].append(f"- **N**: {stats['count']:,} mediciones")
            analysis['content'].append(f"- **Media**: {stats['mean']:.4f} mm/hr")
            analysis['content'].append(f"- **Mediana**: {stats['median']:.4f} mm/hr")
            analysis['content'].append(f"- **Coeficiente de Variación**: {stats['cv']:.1f}%")
            
            if stats['cv'] > 100:
                analysis['content'].append("  - Interpretación: Variabilidad extrema. Precipitación altamente irregular.")
            
            analysis['content'].append("\n### Percentiles\n")
            analysis['content'].append(f"- **P25 (Q1)**: {stats['q25']:.4f} mm/hr")
            analysis['content'].append(f"- **P50 (Mediana)**: {stats['median']:.4f} mm/hr")
            analysis['content'].append(f"- **P75 (Q3)**: {stats['q75']:.4f} mm/hr")
    
    elif current_page == '/suelo-clima' and gldas_df is not None:
        if 'soilmoi0_10cm_inst' in gldas_df.columns:
            stats = calculate_statistical_summary(gldas_df, 'soilmoi0_10cm_inst')
            
            analysis['content'].append("## ANÁLISIS ESTADÍSTICO - HUMEDAD DEL SUELO\n")
            analysis['content'].append("\n### Estadística Descriptiva\n")
            analysis['content'].append(f"- **N**: {stats['count']:,} observaciones")
            analysis['content'].append(f"- **Media**: {stats['mean']:.2f}")
            analysis['content'].append(f"- **Mediana**: {stats['median']:.2f}")
            analysis['content'].append(f"- **Coeficiente de Variación**: {stats['cv']:.1f}%")
            
            # Correlación con temperatura si existe
            if 'tair_f_inst_c' in gldas_df.columns:
                corr, p_val = stats.pearsonr(
                    gldas_df['soilmoi0_10cm_inst'].dropna(),
                    gldas_df['tair_f_inst_c'].dropna()
                )
                analysis['content'].append("\n### Correlación Humedad-Temperatura\n")
                analysis['content'].append(f"- **Coeficiente de Pearson**: {corr:.3f}")
                analysis['content'].append(f"- **p-value**: {p_val:.4f}")
                analysis['content'].append(f"- **Significancia**: {'Estadísticamente significativa' if p_val < 0.05 else 'No significativa'}")
    
    if not analysis['content']:
        analysis['content'].append("Navegue a una sección específica para análisis estadístico detallado.")
    
    return analysis

def generate_trend_analysis(current_page):
    """Generar análisis de tendencias y proyecciones"""
    trends = {
        'type': 'trends',
        'title': 'Análisis de Tendencias y Proyecciones',
        'content': []
    }
    
    if current_page == '/incendios' and fire_df is not None:
        if 'fecha' in fire_df.columns and 'frp' in fire_df.columns:
            trend = calculate_trend(fire_df, 'fecha', 'frp')
            
            trends['content'].append("## TENDENCIAS - INCENDIOS FORESTALES\n")
            
            if trend:
                trends['content'].append("\n### Análisis de Regresión Lineal\n")
                trends['content'].append(f"- **Pendiente**: {trend['slope']:.6f} MW/día")
                trends['content'].append(f"- **R²**: {trend['r_squared']:.4f}")
                trends['content'].append(f"- **p-value**: {trend['p_value']:.6f}")
                trends['content'].append(f"- **Dirección**: {'ASCENDENTE ↗' if trend['direction'] == 'increasing' else 'DESCENDENTE ↘'}")
                
                if trend['significant']:
                    trends['content'].append("\n**Interpretación**: La tendencia es estadísticamente significativa (p<0.05).")
                    if trend['direction'] == 'increasing':
                        trends['content'].append("⚠️ Los incendios muestran tendencia creciente sistemática. Reforzar medidas preventivas.")
                    else:
                        trends['content'].append("✅ Los incendios muestran tendencia decreciente. Mantener estrategias actuales.")
                else:
                    trends['content'].append("\n**Interpretación**: No se detecta tendencia significativa. Variación aleatoria.")
                
                # Proyección simple
                days_ahead = 30
                projection = trend['intercept'] + trend['slope'] * days_ahead
                trends['content'].append(f"\n### Proyección a 30 Días\n")
                trends['content'].append(f"- Valor proyectado: {projection:.2f} MW (modelo lineal simple)")
                trends['content'].append("- **Advertencia**: Esta es una proyección simplificada. Factores externos (clima, actividad humana) pueden alterar significativamente el resultado.")
    
    elif current_page == '/precipitacion' and gpm_df is not None:
        if 'fecha' in gpm_df.columns and 'precipitation' in gpm_df.columns:
            trend = calculate_trend(gpm_df, 'fecha', 'precipitation')
            
            trends['content'].append("## TENDENCIAS - PRECIPITACIÓN\n")
            
            if trend:
                trends['content'].append("\n### Análisis de Regresión\n")
                trends['content'].append(f"- **Tendencia**: {trend['direction'].upper()}")
                trends['content'].append(f"- **R²**: {trend['r_squared']:.4f}")
                trends['content'].append(f"- **Significancia**: {'Sí (p<0.05)' if trend['significant'] else 'No'}")
                
                if trend['significant'] and trend['direction'] == 'decreasing':
                    trends['content'].append("\n⚠️ **Alerta**: Tendencia decreciente significativa en precipitación.")
                    trends['content'].append("Posible transición hacia condiciones más secas. Preparar estrategias de adaptación.")
    
    if not trends['content']:
        trends['content'].append("No hay suficientes datos temporales para análisis de tendencias.")
    
    return trends

def explain_current_view(current_page):
    """Explicar vista actual con detalle técnico"""
    explanation = {
        'type': 'explanation',
        'title': 'Guía Técnica del Dashboard',
        'content': []
    }
    
    if current_page == '/incendios':
        explanation['content'] = [
            "## DASHBOARD DE INCENDIOS FORESTALES\n",
            "### Fuente de Datos",
            "- **Satélites**: MODIS (Terra/Aqua) - NASA",
            "- **Producto**: MOD14A1 (detección térmica diaria)",
            "- **Resolución espacial**: 1km",
            "",
            "### Métricas Clave",
            "**FRP (Fire Radiative Power)**",
            "- Unidad: Megavatios (MW)",
            "- Definición: Energía radiativa emitida por el fuego",
            "- Interpretación:",
            "  - <10 MW: Incendio muy bajo (quemas agrícolas controladas)",
            "  - 10-50 MW: Intensidad baja-media",
            "  - 50-100 MW: Intensidad media-alta (requiere atención)",
            "  - >100 MW: Intensidad crítica (emergencia)",
            "",
            "**Confianza de Detección**",
            "- Rango: 0-100%",
            "- <30%: Baja confianza (verificación requerida)",
            "- 30-70%: Confianza media",
            "- >70%: Alta confianza (datos fiables)",
            "",
            "### Visualizaciones",
            "1. **Mapa de Calor**: Distribución espacial y clusters de incendios",
            "2. **Serie Temporal**: Evolución diaria con tendencias",
            "3. **Boxplot**: Variabilidad de FRP por región (detecta outliers)",
            "4. **Heatmap Mensual**: Patrones estacionales",
            "",
            "### Aplicaciones",
            "- Monitoreo en tiempo real",
            "- Planificación de recursos de emergencia",
            "- Análisis de riesgo provincial",
            "- Evaluación de políticas de prevención"
        ]
    
    elif current_page == '/precipitacion':
        explanation['content'] = [
            "## DASHBOARD DE PRECIPITACIÓN\n",
            "### Fuente de Datos",
            "- **Satélite**: GPM (Global Precipitation Measurement) - NASA/JAXA",
            "- **Producto**: IMERG (Integrated Multi-satellitE Retrievals)",
            "- **Resolución temporal**: 30 minutos",
            "- **Resolución espacial**: 0.1° (~11km)",
            "",
            "### Métricas Clave",
            "**Precipitación (mm/hr)**",
            "- Tasa de precipitación instantánea",
            "- Interpretación:",
            "  - <0.001: Condiciones secas",
            "  - 0.001-0.005: Lluvia ligera",
            "  - 0.005-0.02: Lluvia moderada",
            "  - >0.02: Lluvia intensa",
            "",
            "**SPI (Standardized Precipitation Index)**",
            "- Índice estandarizado de sequía",
            "- Escala:",
            "  - SPI < -2: Sequía extrema",
            "  - -2 < SPI < -1.5: Sequía severa",
            "  - -1.5 < SPI < -1: Sequía moderada",
            "  - -1 < SPI < 1: Condiciones normales",
            "  - SPI > 1: Condiciones húmedas",
            "",
            "### Visualizaciones",
            "1. **Serie Temporal**: Precipitación diaria y acumulada",
            "2. **Boxplot Provincial**: Variabilidad regional",
            "3. **Heatmap Espacial**: Distribución geográfica",
            "4. **Análisis de Sequía**: Clasificación por SPI",
            "",
            "### Aplicaciones",
            "- Gestión de recursos hídricos",
            "- Planificación agrícola",
            "- Alerta temprana de sequías",
            "- Evaluación de riesgo de inundaciones"
        ]
    
    elif current_page == '/suelo-clima':
        explanation['content'] = [
            "## DASHBOARD DE SUELO Y CLIMA\n",
            "### Fuente de Datos",
            "- **Sistema**: GLDAS (Global Land Data Assimilation System) - NASA",
            "- **Modelo**: NOAH (asimilación de datos terrestres)",
            "- **Resolución temporal**: 3 horas",
            "- **Resolución espacial**: 0.25° (~27km)",
            "",
            "### Variables Monitoreadas",
            "**Humedad del Suelo (0-10cm)**",
            "- Contenido volumétrico de agua en capa superficial",
            "- Umbrales agronómicos:",
            "  - <100: Punto de marchitez permanente (crítico)",
            "  - 100-150: Estrés hídrico alto",
            "  - 150-200: Estrés moderado",
            "  - >200: Condiciones adecuadas",
            "",
            "**Temperatura del Aire (°C)**",
            "- Temperatura instantánea a 2m de altura",
            "- Rangos para cultivos:",
            "  - <10°C: Riesgo de heladas",
            "  - 10-26°C: Rango óptimo",
            "  - 26-30°C: Estrés térmico moderado",
            "  - >30°C: Estrés térmico severo",
            "",
            "**Balance Hídrico**",
            "- Precipitación - Evapotranspiración",
            "- Negativo: Déficit hídrico",
            "- Positivo: Superávit hídrico",
            "",
            "### Visualizaciones",
            "1. **Serie Temporal**: Evolución de humedad con umbrales",
            "2. **Análisis Multi-Variable**: Comparación simultánea",
            "3. **Correlación Suelo-Incendios**: Análisis de riesgo",
            "4. **Heatmap Espacial**: Distribución geográfica",
            "",
            "### Aplicaciones",
            "- Predicción de riesgo de incendios",
            "- Optimización de riego agrícola",
            "- Evaluación de estrés hídrico",
            "- Planificación de siembra"
        ]
    
    return explanation

def generate_recommendations(current_page):
    """Generar recomendaciones específicas y accionables"""
    recommendations = {
        'type': 'recommendations',
        'title': 'Recomendaciones Estratégicas Basadas en Datos',
        'content': []
    }
    
    if current_page == '/incendios':
        recommendations['content'] = [
            "## RECOMENDACIONES - GESTIÓN DE INCENDIOS\n",
            "### Corto Plazo (24-72 horas)",
            "1. **Monitoreo Intensivo**",
            "   - Revisar mapas cada 4 horas",
            "   - Activar alertas automáticas para FRP >50 MW",
            "   - Coordinar con estaciones meteorológicas para pronóstico de vientos",
            "",
            "2. **Despliegue de Recursos**",
            "   - Posicionar brigadas en provincias con >5 hotspots activos",
            "   - Preparar helicópteros en zonas de alta concentración",
            "   - Verificar disponibilidad de agua en sectores críticos",
            "",
            "3. **Comunicación**",
            "   - Emitir alertas a poblaciones en radio de 5km de hotspots",
            "   - Coordinar con COE provinciales",
            "   - Actualizar redes sociales oficiales cada 6 horas",
            "",
            "### Mediano Plazo (1-4 semanas)",
            "4. **Prevención Proactiva**",
            "   - Crear cortafuegos en zonas de alto riesgo identificadas",
            "   - Realizar quemas controladas en períodos de baja intensidad",
            "   - Inspeccionar líneas eléctricas en áreas forestales",
            "",
            "5. **Capacitación**",
            "   - Entrenar brigadas comunitarias en 3 provincias prioritarias",
            "   - Simular escenarios de emergencia con equipos",
            "   - Talleres de prevención en comunidades rurales",
            "",
            "### Largo Plazo (1-6 meses)",
            "6. **Infraestructura**",
            "   - Instalar torres de vigilancia en 5 puntos estratégicos",
            "   - Construir reservorios de agua en zonas críticas",
            "   - Mejorar accesos viales a áreas forestales",
            "",
            "7. **Política Pública**",
            "   - Revisar normativa sobre quemas agrícolas",
            "   - Establecer incentivos para manejo forestal sostenible",
            "   - Crear fondo de emergencia para incendios",
            "",
            "### Análisis Basado en Datos",
            "- Usar análisis de correlación humedad-incendios para predicción",
            "- Implementar sistema de alerta temprana basado en umbrales de FRP",
            "- Integrar datos meteorológicos para modelos predictivos"
        ]
    
    elif current_page == '/precipitacion':
        recommendations['content'] = [
            "## RECOMENDACIONES - GESTIÓN HÍDRICA\n",
            "### Corto Plazo",
            "1. **Monitoreo de Sequía**",
            "   - Revisar índice SPI diariamente",
            "   - Activar protocolo de emergencia si SPI < -2",
            "   - Medir niveles de embalses semanalmente",
            "",
            "2. **Conservación de Agua**",
            "   - Implementar restricciones horarias en zonas críticas",
            "   - Campaña de concientización en medios",
            "   - Reparar fugas en sistemas municipales",
            "",
            "### Mediano Plazo",
            "3. **Infraestructura**",
            "   - Construir sistemas de captación de agua lluvia",
            "   - Rehabilitar canales de riego",
            "   - Instalar sensores de humedad en cultivos",
            "",
            "4. **Agricultura**",
            "   - Promover riego tecnificado (goteo, microaspersión)",
            "   - Diversificar cultivos según disponibilidad hídrica",
            "   - Establecer calendarios agrícolas basados en datos GPM",
            "",
            "### Largo Plazo",
            "5. **Política Hídrica**",
            "   - Actualizar planes de ordenamiento territorial",
            "   - Crear reservas hídricas estratégicas",
            "   - Implementar tarifas progresivas de agua",
            "",
            "6. **Adaptación Climática**",
            "   - Reforestación de cuencas hidrográficas",
            "   - Protección de páramos y humedales",
            "   - Investigación de variedades resistentes a sequía"
        ]
    
    elif current_page == '/suelo-clima':
        recommendations['content'] = [
            "## RECOMENDACIONES - MANEJO AGROCLIMÁTICO\n",
            "### Corto Plazo",
            "1. **Riego Inteligente**",
            "   - Activar riego cuando humedad <150",
            "   - Programar riegos nocturnos para reducir evaporación",
            "   - Usar tensiómetros para decisiones precisas",
            "",
            "2. **Protección de Cultivos**",
            "   - Aplicar mulching en suelos expuestos",
            "   - Sombreaderos en cultivos sensibles al calor",
            "   - Cosecha anticipada si se proyecta sequía",
            "",
            "### Mediano Plazo",
            "3. **Mejoramiento del Suelo**",
            "   - Incorporar materia orgánica (compost, abonos verdes)",
            "   - Labranza mínima para conservar humedad",
            "   - Rotación de cultivos para salud del suelo",
            "",
            "4. **Agricultura de Precisión**",
            "   - Zonificar parcelas según humedad del suelo",
            "   - Aplicación variable de agua y fertilizantes",
            "   - Integrar datos GLDAS en sistemas de manejo",
            "",
            "### Largo Plazo",
            "5. **Sistemas Resilientes**",
            "   - Agroforestería para microclima favorable",
            "   - Conservación de suelos (terrazas, zanjas)",
            "   - Bancos de germoplasma de variedades tolerantes",
            "",
            "6. **Investigación**",
            "   - Validación local de datos satelitales",
            "   - Modelos predictivos de rendimiento",
            "   - Desarrollo de variedades adaptadas"
        ]
    
    if not recommendations['content']:
        recommendations['content'].append("Navegue a una sección específica para recomendaciones personalizadas.")
    
    return recommendations

def provide_navigation_help():
    """Proporcionar ayuda de navegación"""
    return {
        'type': 'help',
        'title': 'Guía de Uso del Dashboard',
        'content': [
            "## CÓMO USAR ESTE DASHBOARD\n",
            "### Navegación Principal",
            "- **Incendios**: Análisis de hotspots y FRP",
            "- **Precipitación**: Monitoreo de lluvia y sequía",
            "- **Suelo & Clima**: Variables terrestres y atmosféricas",
            "- **Análisis Integrado**: Correlaciones multi-dataset",
            "",
            "### Filtros Interactivos",
            "1. **Rango de Fechas**: Seleccione período de análisis",
            "2. **Provincia**: Filtra en cascada a cantones",
            "3. **Variables específicas**: Umbrales de FRP, precipitación, etc.",
            "4. **Botón Reset**: Restaura filtros por defecto",
            "",
            "### Asistente Virtual",
            "- Click en botón flotante (inferior derecha)",
            "- Consultas sugeridas o escriba pregunta personalizada",
            "- Pregunta por: análisis, alertas, explicaciones, recomendaciones",
            "",
            "### Exportar Datos",
            "- Botones de descarga en cada sección",
            "- Formatos: CSV, Excel",
            "- Incluye datos filtrados actualmente",
            "",
            "### Interpretación de Gráficos",
            "- **Hover**: Información detallada al pasar cursor",
            "- **Zoom**: Click y arrastre para ampliar",
            "- **Leyenda**: Click para mostrar/ocultar series",
            "- **Descarga**: Ícono cámara (superior derecha de gráficos)",
            "",
            "### Consejos",
            "- Use filtros de fecha para análisis temporales",
            "- Compare provincias para identificar patrones regionales",
            "- Revise insights automáticos en tarjetas azules",
            "- Consulte asistente para interpretaciones técnicas"
        ]
    }

def generate_contextual_response(query, current_page):
    """Respuesta contextual genérica"""
    return {
        'type': 'contextual',
        'title': 'Respuesta del Asistente',
        'content': [
            f"He recibido tu consulta: '{query}'",
            "",
            "Puedo ayudarte mejor si especificas:",
            "- ¿Necesitas **análisis estadístico** de los datos actuales?",
            "- ¿Buscas **alertas** o situaciones críticas?",
            "- ¿Requieres **explicación** de algún gráfico o métrica?",
            "- ¿Deseas **recomendaciones** de acción?",
            "",
            "También puedes preguntarme sobre:",
            "- Provincias o regiones específicas",
            "- Tendencias temporales",
            "- Correlaciones entre variables",
            "- Interpretación de índices (FRP, SPI, etc.)",
            "",
            "Usa los botones de consulta rápida o reformula tu pregunta con más detalle."
        ]
    }

def analyze_geographic_query(query, current_filters):
    """Analizar consultas geográficas específicas"""
    # Extraer provincia mencionada
    query_lower = query.lower()
    
    # Buscar provincia mencionada
    mentioned_province = None
    for province_key, province_name in ECUADOR_PROVINCES.items():
        if province_name.lower() in query_lower or province_key.lower() in query_lower:
            mentioned_province = province_name
            break
    
    response = {
        'type': 'geographic',
        'title': f'Análisis Geográfico{" - " + mentioned_province if mentioned_province else ""}',
        'content': []
    }
    
    if mentioned_province:
        # Análisis específico de la provincia
        response['content'].append(f"## ANÁLISIS: {mentioned_province.upper()}\n")
        
        # Incendios
        if fire_df is not None and 'provincia' in fire_df.columns:
            province_fires = fire_df[fire_df['provincia'] == mentioned_province]
            if len(province_fires) > 0:
                response['content'].append(f"### Incendios")
                response['content'].append(f"- Total detecciones: {len(province_fires)}")
                if 'frp' in province_fires.columns:
                    response['content'].append(f"- FRP promedio: {province_fires['frp'].mean():.2f} MW")
                    response['content'].append(f"- FRP máximo: {province_fires['frp'].max():.2f} MW")
                response['content'].append("")
        
        # Precipitación
        if gpm_df is not None and 'provincia' in gpm_df.columns:
            province_precip = gpm_df[gpm_df['provincia'] == mentioned_province]
            if len(province_precip) > 0 and 'precipitation' in province_precip.columns:
                response['content'].append(f"### Precipitación")
                response['content'].append(f"- Promedio: {province_precip['precipitation'].mean():.4f} mm/hr")
                response['content'].append(f"- Registros: {len(province_precip)}")
                response['content'].append("")
        
        # Suelo
        if gldas_df is not None and 'provincia' in gldas_df.columns:
            province_soil = gldas_df[gldas_df['provincia'] == mentioned_province]
            if len(province_soil) > 0 and 'soilmoi0_10cm_inst' in province_soil.columns:
                response['content'].append(f"### Humedad del Suelo")
                response['content'].append(f"- Promedio: {province_soil['soilmoi0_10cm_inst'].mean():.1f}")
                response['content'].append("")
    else:
        response['content'].append("No se identificó una provincia específica en tu consulta.")
        response['content'].append("\nProvincias disponibles: " + ", ".join(sorted(ECUADOR_PROVINCES.values())))
    
    return response

# =============================================================================
# INICIALIZACIÓN DE LA APLICACIÓN DASH
# =============================================================================
app = Dash(__name__, 
          external_stylesheets=[
              dbc.themes.CYBORG,
              'https://cdn.jsdelivr.net/npm/bootstrap-icons@1.10.0/font/bootstrap-icons.css',
              '/assets/media_dashboard.css'
          ],
          suppress_callback_exceptions=True,
          title="NASA Ecuador Dashboard")

server = app.server  # Para despliegue en Hugging Face



# =============================================================================
# LAYOUT PRINCIPAL
# =============================================================================
app.layout = dbc.Container([
    dcc.Location(id='url', refresh=False),
    
    # Enhanced Navbar with custom styling
    html.Header([
        html.Nav([
            html.Div([
                # Logo/Brand
                html.Div([
                    html.Span("🛰️", className="logo-icon"),
                    html.Span("NASA Ecuador - Sistema de Monitoreo Satelital", className="brand-text")
                ], className="navbar-brand"),
                
                # Desktop Navigation
                html.Div([
                    html.Ul([
                        html.Li([
                            html.A("🏠 Inicio", href="/", className="nav-link")
                        ], className="nav-item"),
                        html.Li([
                            html.A("🔥 Incendios", href="/incendios", className="nav-link")
                        ], className="nav-item"),
                        html.Li([
                            html.A("💧 Precipitación", href="/precipitacion", className="nav-link")
                        ], className="nav-item"),
                        html.Li([
                            html.A("🌱 Suelo & Clima", href="/suelo-clima", className="nav-link")
                        ], className="nav-item"),
                        html.Li([
                            html.A("🔮 Predicciones", href="/predicciones", className="nav-link")
                        ], className="nav-item"),
                    ], className="navbar-nav")
                ], className="navbar-menu", id="navbarMenu"),
                
                # Mobile Hamburger Button
                html.Button([
                    html.Span(className="hamburger-line"),
                    html.Span(className="hamburger-line"),
                    html.Span(className="hamburger-line")
                ], className="navbar-toggler", id="navbarToggler")
            ], className="navbar-container")
        ], className="navbar")
    ], className="header-nav"),
    
    # Contenido dinámico
    html.Div(id='page-content'),
    
    # Asistente virtual
    create_chatbot_component(),
    
    # Stores para estados
    dcc.Store(id='current-filters', data={}),
    dcc.Store(id='chat-history', data=[])
    
], fluid=True, style={'backgroundColor': COLORS['bg_primary'], 'minHeight': '100vh', 'padding': '20px', 'paddingTop': '90px', 'margin': '0'})

# =============================================================================
# ESTILOS CSS PERSONALIZADOS PARA EL NAVBAR
# =============================================================================

# Agregar estilos CSS personalizados
app.index_string = '''
<!DOCTYPE html>
<html>
    <head>
        {%metas%}
        <title>{%title%}</title>
        {%favicon%}
        {%css%}
        <style>
            /* Header Navigation Styles - Dashboard Version */
            .header-nav {
                position: fixed !important;
                top: 0 !important;
                left: 0 !important;
                right: 0 !important;
                width: 100vw !important;
                z-index: 9999 !important;
                background: linear-gradient(135deg, 
                    rgba(13, 27, 42, 0.98) 0%, 
                    rgba(21, 32, 54, 0.95) 50%, 
                    rgba(13, 27, 42, 0.98) 100%) !important;
                backdrop-filter: blur(20px) !important;
                border-bottom: 2px solid rgba(66, 165, 245, 0.3) !important;
                box-shadow: 
                    0 8px 32px rgba(0, 0, 0, 0.6),
                    0 0 20px rgba(66, 165, 245, 0.1) !important;
                margin: 0 !important;
                padding: 0 !important;
                transition: all 0.3s ease !important;
            }

            .navbar {
                width: 100% !important;
                padding: 0 !important;
                margin: 0 !important;
                background: transparent !important;
                border: none !important;
            }

            .navbar-container {
                max-width: 1400px !important;
                margin: 0 auto !important;
                display: flex !important;
                align-items: center !important;
                justify-content: space-between !important;
                padding: 15px 25px !important;
                height: 70px !important;
                background: transparent !important;
            }

            .navbar-brand {
                display: flex !important;
                align-items: center !important;
                gap: 10px !important;
                text-decoration: none !important;
                color: #ffffff !important;
                font-weight: bold !important;
                font-size: 1.2rem !important;
                cursor: pointer !important;
            }

            .logo-icon {
                font-size: 2rem !important;
                filter: drop-shadow(0 0 15px rgba(66, 165, 245, 0.7)) !important;
                animation: glow 2s ease-in-out infinite alternate !important;
            }

            @keyframes glow {
                from { filter: drop-shadow(0 0 15px rgba(66, 165, 245, 0.7)); }
                to { filter: drop-shadow(0 0 25px rgba(66, 165, 245, 0.9)); }
            }

            .brand-text {
                background: linear-gradient(45deg, #42a5f5, #66bb6a) !important;
                -webkit-background-clip: text !important;
                -webkit-text-fill-color: transparent !important;
                background-clip: text !important;
                font-weight: 700 !important;
                letter-spacing: 0.5px !important;
            }

            .navbar-menu {
                display: flex !important;
                align-items: center !important;
            }

            .navbar-nav {
                display: flex !important;
                align-items: center !important;
                list-style: none !important;
                gap: 8px !important;
                margin: 0 !important;
                padding: 0 !important;
            }

            .nav-item {
                position: relative !important;
            }

            .nav-link {
                display: flex !important;
                align-items: center !important;
                padding: 12px 20px !important;
                color: rgba(255, 255, 255, 0.95) !important;
                text-decoration: none !important;
                border-radius: 25px !important;
                font-weight: 600 !important;
                font-size: 1rem !important;
                transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1) !important;
                white-space: nowrap !important;
                background: rgba(255, 255, 255, 0.05) !important;
                border: 1px solid rgba(255, 255, 255, 0.1) !important;
                backdrop-filter: blur(10px) !important;
                position: relative !important;
                overflow: hidden !important;
            }

            .nav-link::before {
                content: '' !important;
                position: absolute !important;
                top: 0 !important;
                left: -100% !important;
                width: 100% !important;
                height: 100% !important;
                background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.2), transparent) !important;
                transition: left 0.5s ease !important;
            }

            .nav-link:hover::before {
                left: 100% !important;
            }

            .nav-link:hover {
                background: linear-gradient(135deg, rgba(66, 165, 245, 0.3), rgba(102, 187, 106, 0.2)) !important;
                color: #fff !important;
                transform: translateY(-3px) scale(1.05) !important;
                box-shadow: 
                    0 8px 25px rgba(66, 165, 245, 0.4),
                    0 0 20px rgba(102, 187, 106, 0.2) !important;
                border-color: rgba(66, 165, 245, 0.5) !important;
            }

            .nav-link:focus {
                outline: none;
                box-shadow: 0 0 0 2px rgba(66, 165, 245, 0.4);
            }

            /* Mobile hamburger menu */
            .navbar-toggler {
                display: none !important;
                flex-direction: column !important;
                justify-content: center !important;
                align-items: center !important;
                width: 45px !important;
                height: 45px !important;
                background: rgba(255, 255, 255, 0.1) !important;
                border: 2px solid rgba(255, 255, 255, 0.2) !important;
                cursor: pointer !important;
                padding: 0 !important;
                gap: 4px !important;
                border-radius: 8px !important;
                backdrop-filter: blur(10px) !important;
                transition: all 0.3s ease !important;
            }

            .navbar-toggler:hover {
                background: rgba(66, 165, 245, 0.2) !important;
                border-color: rgba(66, 165, 245, 0.5) !important;
                transform: scale(1.05) !important;
            }

            .hamburger-line {
                width: 24px !important;
                height: 3px !important;
                background: #ffffff !important;
                transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1) !important;
                border-radius: 2px !important;
                box-shadow: 0 0 5px rgba(66, 165, 245, 0.3) !important;
            }

            .navbar-toggler.active .hamburger-line:nth-child(1) {
                transform: rotate(45deg) translate(6px, 6px);
            }

            .navbar-toggler.active .hamburger-line:nth-child(2) {
                opacity: 0;
            }

            .navbar-toggler.active .hamburger-line:nth-child(3) {
                transform: rotate(-45deg) translate(6px, -6px);
            }

            /* Active link styling */
            .nav-link.active {
                background: linear-gradient(135deg, rgba(66, 165, 245, 0.4), rgba(102, 187, 106, 0.3)) !important;
                color: #ffffff !important;
                font-weight: 700 !important;
                box-shadow: 
                    0 6px 20px rgba(66, 165, 245, 0.5),
                    inset 0 2px 4px rgba(255, 255, 255, 0.1) !important;
                border-color: rgba(66, 165, 245, 0.7) !important;
                transform: translateY(-2px) !important;
            }

            .nav-link.active::after {
                content: '' !important;
                position: absolute !important;
                bottom: -2px !important;
                left: 50% !important;
                transform: translateX(-50%) !important;
                width: 80% !important;
                height: 3px !important;
                background: linear-gradient(90deg, #42a5f5, #66bb6a) !important;
                border-radius: 2px !important;
            }

            /* Responsive styles now handled by external media_dashboard.css */

            /* Dashboard specific adjustments */
            body {
                padding-top: 70px !important;
                margin: 0 !important;
            }

            /* Fix Dash container padding and override Bootstrap */
            ._dash-undo-redo {
                display: none !important;
            }

            .container-fluid, .container {
                padding-top: 0 !important;
                margin-top: 0 !important;
            }

            /* Override Bootstrap/Cyborg theme completely */
            .header-nav {
                border-bottom: 1px solid rgba(255, 255, 255, 0.2) !important;
            }

            .header-nav * {
                box-sizing: border-box !important;
            }

            /* Make sure the header appears above everything */
            .header-nav {
                position: fixed !important;
                z-index: 9999 !important;
            }

            /* Override any conflicting Bootstrap navbar styles */
            .navbar, .navbar > * {
                background: transparent !important;
                border: none !important;
                border-radius: 0 !important;
            }

            /* Ensure proper spacing */
            #react-entry-point {
                padding-top: 0 !important;
            }
        </style>
    </head>
    <body>
        {%app_entry%}
        <footer>
            {%config%}
            {%scripts%}
            {%renderer%}
            
            <script>
                // Mobile menu functionality
                document.addEventListener('DOMContentLoaded', function() {
                    const navbarToggler = document.getElementById('navbarToggler');
                    const navbarMenu = document.getElementById('navbarMenu');
                    
                    if (navbarToggler && navbarMenu) {
                        navbarToggler.addEventListener('click', function() {
                            navbarToggler.classList.toggle('active');
                            navbarMenu.classList.toggle('active');
                        });
                        
                        // Close mobile menu when clicking outside
                        document.addEventListener('click', function(event) {
                            if (!navbarToggler.contains(event.target) && !navbarMenu.contains(event.target)) {
                                navbarToggler.classList.remove('active');
                                navbarMenu.classList.remove('active');
                            }
                        });
                        
                        // Close mobile menu when clicking on nav links
                        const navLinks = navbarMenu.querySelectorAll('.nav-link');
                        navLinks.forEach(link => {
                            link.addEventListener('click', function() {
                                navbarToggler.classList.remove('active');
                                navbarMenu.classList.remove('active');
                            });
                        });
                    }
                    
                    // Highlight active nav link based on current URL
                    function updateActiveNavLink() {
                        const currentPath = window.location.pathname;
                        const navLinks = document.querySelectorAll('.nav-link');
                        
                        navLinks.forEach(link => {
                            link.classList.remove('active');
                            if (link.getAttribute('href') === currentPath) {
                                link.classList.add('active');
                            }
                        });
                    }
                    
                    // Update active link on page load
                    updateActiveNavLink();
                    
                    // Update active link when URL changes (for SPA navigation)
                    window.addEventListener('popstate', updateActiveNavLink);
                    
                    // Monitor for Dash navigation changes
                    const observer = new MutationObserver(function(mutations) {
                        mutations.forEach(function(mutation) {
                            if (mutation.type === 'childList') {
                                setTimeout(updateActiveNavLink, 100);
                            }
                        });
                    });
                    
                    observer.observe(document.getElementById('page-content'), {
                        childList: true,
                        subtree: true
                    });
                });
            </script>
        </footer>
    </body>
</html>
'''

# =============================================================================
# CALLBACKS - NAVEGACIÓN
# =============================================================================
@app.callback(
    Output('page-content', 'children'),
    Input('url', 'pathname')
)
def display_page(pathname):
    if pathname == '/incendios':
        return create_fire_page()
    elif pathname == '/precipitacion':
        return create_precipitation_page()
    elif pathname == '/suelo-clima':
        return create_soil_climate_page()
    elif pathname == '/predicciones':
        return create_predictions_page()
    else:
        return create_home_page()

def create_home_page():
    """Página de inicio"""
    return html.Div([
        dbc.Row([
            dbc.Col([
                html.H1("🛰️ Sistema de Monitoreo Satelital NASA - Ecuador", className="text-center mb-4",
                       style={'color': COLORS['primary'], 'fontWeight': 'bold'}),
                html.P("Análisis en tiempo real de datos satelitales para gestión ambiental y prevención de desastres",
                      className="text-center lead mb-5", style={'color': COLORS['text_secondary']})
            ])
        ]),
        
        # Tarjetas de dataset
        dbc.Row([
            dbc.Col([
                dbc.Card([
                    dbc.CardBody([
                        html.I(className="bi bi-fire", style={'fontSize': '4rem', 'color': COLORS['danger']}),
                        html.H3("Incendios Forestales", className="mt-3"),
                        html.P("Detección satelital MODIS con FRP", className="text-muted"),
                        html.Hr(),
                        html.P(f"📊 {len(fire_df):,} detecciones" if fire_df is not None else "📊 No disponible"),
                        dbc.Button("Explorar →", href="/incendios", color="danger", size="lg", className="w-100 mt-2")
                    ], className="text-center")
                ], className="h-100 shadow", style={'backgroundColor': COLORS['bg_card'], 'border': f'2px solid {COLORS["danger"]}'})
            ], md=4),
            
            dbc.Col([
                dbc.Card([
                    dbc.CardBody([
                        html.I(className="bi bi-cloud-rain", style={'fontSize': '4rem', 'color': COLORS['primary']}),
                        html.H3("Precipitación", className="mt-3"),
                        html.P("Mediciones GPM/IMERG", className="text-muted"),
                        html.Hr(),
                        html.P(f"📊 {len(gpm_df):,} registros" if gpm_df is not None else "📊 No disponible"),
                        dbc.Button("Explorar →", href="/precipitacion", color="primary", size="lg", className="w-100 mt-2")
                    ], className="text-center")
                ], className="h-100 shadow", style={'backgroundColor': COLORS['bg_card'], 'border': f'2px solid {COLORS["primary"]}'})
            ], md=4),
            
            dbc.Col([
                dbc.Card([
                    dbc.CardBody([
                        html.I(className="bi bi-moisture", style={'fontSize': '4rem', 'color': COLORS['success']}),
                        html.H3("Suelo & Clima", className="mt-3"),
                        html.P("Datos GLDAS terrestres", className="text-muted"),
                        html.Hr(),
                        html.P(f"📊 {len(gldas_df):,} mediciones" if gldas_df is not None else "📊 No disponible"),
                        dbc.Button("Explorar →", href="/suelo-clima", color="success", size="lg", className="w-100 mt-2")
                    ], className="text-center")
                ], className="h-100 shadow", style={'backgroundColor': COLORS['bg_card'], 'border': f'2px solid {COLORS["success"]}'})
            ], md=4)
        ], className="mb-5"),
        
        # Información adicional
        dbc.Row([
            dbc.Col([
                dbc.Card([
                    dbc.CardHeader("ℹ️ Acerca del Sistema", style={'backgroundColor': COLORS['bg_secondary']}),
                    dbc.CardBody([
                        dcc.Markdown("""
Este dashboard integra datos satelitales de la NASA para el monitoreo ambiental de Ecuador:

- **MODIS**: Detección de incendios con FRP
- **GPM**: Precipitación con resolución de 30 minutos
- **GLDAS**: Variables terrestres y atmosféricas

**Características:**
- ✅ Análisis estadístico avanzado
- ✅ Visualizaciones interactivas
- ✅ Filtros geográficos y temporales
- ✅ Asistente virtual con IA
- ✅ Insights automáticos
                        """, style={'color': COLORS['text_primary']})
                    ])
                ], style={'backgroundColor': COLORS['bg_card']})
            ], md=12)
        ])
    ])

def create_fire_page():
    """Página de análisis de incendios"""
    if fire_df is None:
        return html.Div("⚠️ Datos de incendios no disponibles", className="text-center text-light mt-5")
    
    insights = generate_fire_insights(fire_df)
    
    return html.Div([
        html.H2("🔥 Análisis de Incendios Forestales", className="mb-4", style={'color': COLORS['danger']}),
        
        dbc.Row([
            dbc.Col([
                create_filter_panel('fire')
            ], md=3),
            
            dbc.Col([
                # Estadísticas
                html.Div(id='fire-stats-cards'),
                
                # Visualizaciones PRIMERO
                dbc.Tabs([
                    dbc.Tab(label="🗺️ Mapa de Calor", tab_id="fire-map"),
                    dbc.Tab(label="📈 Serie Temporal", tab_id="fire-timeseries"),
                    dbc.Tab(label="📊 Por Provincia", tab_id="fire-province"),
                    dbc.Tab(label="📦 Distribución FRP", tab_id="fire-boxplot"),
                    dbc.Tab(label="🎯 Confianza", tab_id="fire-confidence"),
                    dbc.Tab(label="🔥 Heatmap Mensual", tab_id="fire-heatmap-monthly"),
                ], id="fire-tabs", active_tab="fire-map"),
                
                html.Div(id='fire-visualization-container', className="mt-3"),
                
                # Insights DESPUÉS
                html.Div(id='fire-insights-container', className="mt-4")
            ], md=9)
        ])
    ])

def create_precipitation_page():
    """Página de análisis de precipitación"""
    if gpm_df is None:
        return html.Div("⚠️ Datos de precipitación no disponibles", className="text-center text-light mt-5")
    
    return html.Div([
        html.H2("💧 Análisis de Precipitación", className="mb-4", style={'color': COLORS['primary']}),
        
        dbc.Row([
            dbc.Col([
                create_filter_panel('precipitation')
            ], md=3),
            
            dbc.Col([
                html.Div(id='precip-stats-cards'),
                
                dbc.Tabs([
                    dbc.Tab(label="📈 Serie Temporal", tab_id="precip-timeseries"),
                    dbc.Tab(label="📦 Por Provincia", tab_id="precip-boxplot"),
                    dbc.Tab(label="🗺️ Heatmap Espacial", tab_id="precip-spatial"),
                    dbc.Tab(label="📊 Distribución", tab_id="precip-histogram"),
                    dbc.Tab(label="🏜️ Análisis Sequía", tab_id="precip-drought"),
                ], id="precip-tabs", active_tab="precip-timeseries"),
                
                html.Div(id='precip-visualization-container', className="mt-3"),
                html.Div(id='precip-insights-container', className="mt-4")
            ], md=9)
        ])
    ])

def create_soil_climate_page():
    """Página de análisis de suelo y clima"""
    if gldas_df is None:
        return html.Div("⚠️ Datos de suelo/clima no disponibles", className="text-center text-light mt-5")
    
    return html.Div([
        html.H2("🌱 Análisis de Suelo y Clima", className="mb-4", style={'color': COLORS['success']}),
        
        dbc.Row([
            dbc.Col([
                create_filter_panel('soil-climate')
            ], md=3),
            
            dbc.Col([
                html.Div(id='soil-stats-cards'),
                
                dbc.Tabs([
                    dbc.Tab(label="💧 Humedad del Suelo", tab_id="soil-moisture"),
                    dbc.Tab(label="🌡️ Multi-Variable", tab_id="soil-multi"),
                    dbc.Tab(label="🗺️ Heatmap Espacial", tab_id="soil-spatial"),
                    dbc.Tab(label="🔗 Correlación con Incendios", tab_id="soil-fire-corr"),
                ], id="soil-tabs", active_tab="soil-moisture"),
                
                html.Div(id='soil-visualization-container', className="mt-3"),
                html.Div(id='soil-insights-container', className="mt-4")
            ], md=9)
        ])
    ])

def create_predictions_page():
    """Página de predicciones - Placeholder"""
    return html.Div([
        dbc.Alert([
            html.H4("🔮 Módulo de Predicciones", className="alert-heading"),
            html.Hr(),
            html.P("Esta funcionalidad está temporalmente deshabilitada para mantenimiento."),
            html.P("Por favor, use las secciones de análisis disponibles:", className="mb-0"),
            html.Ul([
                html.Li("Incendios Forestales"),
                html.Li("Precipitación"),
                html.Li("Suelo & Clima")
            ])
        ], color="info", className="mt-5")
    ], className="container mt-5")
    
# =============================================================================
# CALLBACKS PARA DASHBOARDS - INCENDIOS
# =============================================================================
@app.callback(
    [Output('fire-stats-cards', 'children'),
     Output('fire-visualization-container', 'children'),
     Output('fire-insights-container', 'children')],
    [Input('fire-tabs', 'active_tab'),
     Input('fire-date-picker', 'start_date'),
     Input('fire-date-picker', 'end_date'),
     Input('fire-province-dropdown', 'value'),
     Input('fire-canton-dropdown', 'value')]
)
def update_fire_dashboard(active_tab, start_date, end_date, province, canton):
    if fire_df is None:
        return html.Div(), html.Div(), html.Div()
    
    # Filtrar datos
    df_filtered = fire_df.copy()
    if start_date and end_date:
        df_filtered = df_filtered[
            (df_filtered['fecha'] >= pd.to_datetime(start_date)) &
            (df_filtered['fecha'] <= pd.to_datetime(end_date))
        ]
    if province != 'all':
        df_filtered = df_filtered[df_filtered['provincia'] == province]
    
    if len(df_filtered) == 0:
        return (
            html.Div("No hay datos con los filtros aplicados", className="text-light"),
            html.Div(),
            html.Div()
        )
    
    # Estadísticas
    stats = create_stats_cards(df_filtered, 'fire')
    
    # Visualización según tab
    if active_tab == 'fire-map':
        viz = dcc.Graph(figure=create_fire_heatmap(df_filtered))
    elif active_tab == 'fire-timeseries':
        viz = dcc.Graph(figure=create_fire_timeseries(df_filtered))
    elif active_tab == 'fire-province':
        viz = dcc.Graph(figure=create_fire_province_chart(df_filtered))
    elif active_tab == 'fire-boxplot':
        viz = dcc.Graph(figure=create_fire_boxplot(df_filtered))
    elif active_tab == 'fire-confidence':
        viz = dcc.Graph(figure=create_fire_confidence_pie(df_filtered))
    elif active_tab == 'fire-heatmap-monthly':
        viz = dcc.Graph(figure=create_fire_heatmap_monthly(df_filtered))
    else:
        viz = html.Div()
    
    # Insights
    insights = generate_fire_insights(df_filtered)
    insights_cards = html.Div([
        create_insight_card(insights.get('spatial', ''), 'bi-geo-alt-fill', COLORS['danger']),
        create_insight_card(insights.get('temporal', ''), 'bi-clock-fill', COLORS['warning']),
        create_insight_card(insights.get('statistical', ''), 'bi-graph-up', COLORS['info']),
        create_insight_card(insights.get('risk', ''), 'bi-exclamation-triangle-fill', COLORS['accent_1'])
    ])
    
    return stats, viz, insights_cards

# =============================================================================
# CALLBACKS PARA DASHBOARDS - PRECIPITACIÓN
# =============================================================================
@app.callback(
    [Output('precip-stats-cards', 'children'),
     Output('precip-visualization-container', 'children'),
     Output('precip-insights-container', 'children')],
    [Input('precip-tabs', 'active_tab'),
     Input('precipitation-date-picker', 'start_date'),
     Input('precipitation-date-picker', 'end_date'),
     Input('precipitation-province-dropdown', 'value'),
     Input('precipitation-canton-dropdown', 'value')]
)
def update_precip_dashboard(active_tab, start_date, end_date, province, canton):
    if gpm_df is None:
        return html.Div(), html.Div(), html.Div()
    
    # Filtrar datos
    df_filtered = gpm_df.copy()
    if start_date and end_date:
        df_filtered = df_filtered[
            (df_filtered['fecha'] >= pd.to_datetime(start_date)) &
            (df_filtered['fecha'] <= pd.to_datetime(end_date))
        ]
    if province != 'all':
        df_filtered = df_filtered[df_filtered['provincia'] == province]
    
    if len(df_filtered) == 0:
        return (
            html.Div("No hay datos", className="text-light"),
            html.Div(),
            html.Div()
        )
    
    stats = create_stats_cards(df_filtered, 'precipitation')
    
    if active_tab == 'precip-timeseries':
        viz = dcc.Graph(figure=create_precipitation_timeseries(df_filtered))
    elif active_tab == 'precip-boxplot':
        viz = dcc.Graph(figure=create_precipitation_boxplot(df_filtered))
    elif active_tab == 'precip-spatial':
        viz = dcc.Graph(figure=create_precipitation_spatial_heatmap(df_filtered))
    elif active_tab == 'precip-histogram':
        viz = dcc.Graph(figure=create_precipitation_histogram(df_filtered))
    elif active_tab == 'precip-drought':
        viz = dcc.Graph(figure=create_precipitation_drought_analysis(df_filtered))
    else:
        viz = html.Div()
    
    insights = generate_precipitation_insights(df_filtered)
    insights_cards = html.Div([
        create_insight_card(insights.get('temporal', ''), 'bi-clock-fill', COLORS['primary']),
        create_insight_card(insights.get('spatial', ''), 'bi-map-fill', COLORS['info']),
        create_insight_card(insights.get('hydrological', ''), 'bi-droplet-fill', COLORS['accent_2']),
        create_insight_card(insights.get('agricultural', ''), 'bi-tree-fill', COLORS['success'])
    ])
    
    return stats, viz, insights_cards

# =============================================================================
# CALLBACKS PARA DASHBOARDS - SUELO Y CLIMA
# =============================================================================
@app.callback(
    [Output('soil-stats-cards', 'children'),
     Output('soil-visualization-container', 'children'),
     Output('soil-insights-container', 'children')],
    [Input('soil-tabs', 'active_tab'),
     Input('soil-climate-date-picker', 'start_date'),
     Input('soil-climate-date-picker', 'end_date'),
     Input('soil-climate-province-dropdown', 'value'),
     Input('soil-climate-canton-dropdown', 'value')]                                               
)
def update_soil_dashboard(active_tab, start_date, end_date, province, canton):
    if gldas_df is None:
        return html.Div(), html.Div(), html.Div()
    
    df_filtered = gldas_df.copy()
    if start_date and end_date:
        df_filtered = df_filtered[
            (df_filtered['fecha'] >= pd.to_datetime(start_date)) &
            (df_filtered['fecha'] <= pd.to_datetime(end_date))
        ]
    if province != 'all':
        df_filtered = df_filtered[df_filtered['provincia'] == province]
    
    if len(df_filtered) == 0:
        return (
            html.Div("No hay datos", className="text-light"),
            html.Div(),
            html.Div()
        )
    
    stats = create_stats_cards(df_filtered, 'soil-climate')
    
    if active_tab == 'soil-moisture':
        viz = dcc.Graph(figure=create_soil_moisture_timeseries(df_filtered))
    elif active_tab == 'soil-multi':
        viz = dcc.Graph(figure=create_multi_variable_comparison(df_filtered))
    elif active_tab == 'soil-spatial':
        viz = dcc.Graph(figure=create_soil_spatial_heatmap(df_filtered))
    elif active_tab == 'soil-fire-corr':
        viz = dcc.Graph(figure=create_soil_fire_correlation(df_filtered, fire_df))
    else:
        viz = html.Div()
    
    insights = generate_soil_insights(df_filtered, fire_df)
    insights_cards = html.Div([
        create_insight_card(insights.get('moisture', ''), 'bi-moisture', COLORS['success']),
        create_insight_card(insights.get('temperature', ''), 'bi-thermometer-half', COLORS['warning']),
        create_insight_card(insights.get('correlation', ''), 'bi-arrow-left-right', COLORS['danger']),
        create_insight_card(insights.get('integrated', ''), 'bi-gear-fill', COLORS['info'])
    ])
    
    return stats, viz, insights_cards

# =============================================================================
# CALLBACKS PARA FILTROS EN CASCADA
# =============================================================================

@app.callback(
    Output('fire-canton-dropdown', 'options'),
    Input('fire-province-dropdown', 'value')
)
def update_fire_cantons(province):
    if fire_df is None or 'canton' not in fire_df.columns:
        return [{'label': 'Todos los Cantones', 'value': 'all'}]
    
    if province == 'all':
        cantons = sorted(fire_df['canton'].dropna().unique())
    else:
        cantons = sorted(fire_df[fire_df['provincia'] == province]['canton'].dropna().unique())
    
    return [{'label': 'Todos los Cantones', 'value': 'all'}] + \
           [{'label': c, 'value': c} for c in cantons if c != 'NO_IDENTIFICADO']

@app.callback(
    Output('precipitation-canton-dropdown', 'options'),
    Input('precipitation-province-dropdown', 'value')
)
def update_precip_cantons(province):
    if gpm_df is None or 'canton' not in gpm_df.columns:
        return [{'label': 'Todos los Cantones', 'value': 'all'}]
    
    if province == 'all':
        cantons = sorted(gpm_df['canton'].dropna().unique())
    else:
        cantons = sorted(gpm_df[gpm_df['provincia'] == province]['canton'].dropna().unique())
    
    return [{'label': 'Todos los Cantones', 'value': 'all'}] + \
           [{'label': c, 'value': c} for c in cantons if c != 'NO_IDENTIFICADO']

@app.callback(
    Output('soil-climate-canton-dropdown', 'options'),
    Input('soil-climate-province-dropdown', 'value')
)
def update_soil_cantons(province):
    if gldas_df is None or 'canton' not in gldas_df.columns:
        return [{'label': 'Todos los Cantones', 'value': 'all'}]
    
    if province == 'all':
        cantons = sorted(gldas_df['canton'].dropna().unique())
    else:
        cantons = sorted(gldas_df[gldas_df['provincia'] == province]['canton'].dropna().unique())
    
    return [{'label': 'Todos los Cantones', 'value': 'all'}] + \
           [{'label': c, 'value': c} for c in cantons if c != 'NO_IDENTIFICADO']

    
# =============================================================================
# CALLBACKS PARA ASISTENTE VIRTUAL
# =============================================================================
@app.callback(
    Output("chat-offcanvas", "is_open"),
    [Input("chat-toggle-button", "n_clicks"),
     Input("quick-1", "n_clicks"),
     Input("quick-2", "n_clicks"),
     Input("quick-3", "n_clicks"),
     Input("quick-4", "n_clicks")],
    [State("chat-offcanvas", "is_open")],
    prevent_initial_call=True
)
def toggle_chat(toggle_clicks, q1, q2, q3, q4, is_open):
    return not is_open

@app.callback(
    Output("chat-messages", "children"),
    [Input("chat-send-button", "n_clicks"),
     Input("quick-1", "n_clicks"),
     Input("quick-2", "n_clicks"),
     Input("quick-3", "n_clicks"),
     Input("quick-4", "n_clicks"),
     Input("chat-input", "n_submit")],
    [State("chat-input", "value"),
     State("url", "pathname"),
     State("current-filters", "data"),
     State("chat-messages", "children")],
    prevent_initial_call=True
)
def update_chat(send_clicks, q1, q2, q3, q4, n_submit, user_input, current_page, filters, current_messages):
    ctx = callback_context
    if not ctx.triggered:
        return current_messages or []
    
    trigger_id = ctx.triggered[0]['prop_id'].split('.')[0]
    
    if trigger_id == "quick-1":
        query = "Dame un análisis de la situación actual"
    elif trigger_id == "quick-2":
        query = "¿Cuáles son las alertas críticas?"
    elif trigger_id == "quick-3":
        query = "Explícame el gráfico actual"
    elif trigger_id == "quick-4":
        query = "Dame recomendaciones"
    else:
        query = user_input
    
    if not query:
        return current_messages or []
    
    # Procesar consulta
    response = process_user_query(query, current_page, filters)
    
    # Crear mensajes
    messages = current_messages or []
    
    # Mensaje del usuario
    user_msg = html.Div([
        html.Div("Usuario", className="text-info small mb-1 text-end"),
        html.Div(query, className="p-3 rounded", 
                style={'backgroundColor': f"{COLORS['info']}20", 'border': f"2px solid {COLORS['info']}60"})
    ], className="mb-3")
    
    # Mensaje del asistente
    bot_msg = html.Div([
        html.Div([
            html.I(className="bi bi-robot me-2"),
            "Asistente NASA"
        ], className="text-primary small mb-1"),
        html.Div([
            dcc.Markdown('\n'.join(response.get('content', ['Sin respuesta'])))
        ], className="p-3 rounded", 
        style={'backgroundColor': f"{COLORS['primary']}20", 'border': f"2px solid {COLORS['primary']}60"})
    ], className="mb-3")
    
    messages.extend([user_msg, bot_msg])
    
    return messages

@app.callback(
    Output("chat-input", "value"),
    [Input("chat-send-button", "n_clicks"),
     Input("chat-input", "n_submit")],
    prevent_initial_call=True
)
def clear_input(n_clicks, n_submit):
    return ""

if __name__ == '__main__':
    print("="*80)
    print("🚀 INICIANDO NASA ECUADOR DASHBOARD")
    print("="*80)
    print(f"📊 Datasets cargados:")
    print(f"   - Incendios (FIRE): {len(fire_df):,} registros" if fire_df is not None else "   - Incendios: No disponible")
    print(f"   - Precipitación (GPM): {len(gpm_df):,} registros" if gpm_df is not None else "   - Precipitación: No disponible")
    print(f"   - Suelo/Clima (GLDAS): {len(gldas_df):,} registros" if gldas_df is not None else "   - Suelo/Clima: No disponible")
    print("="*80)
    print(f"🌐 Servidor iniciando en puerto {PORT}")
    print(f"🔗 URL: http://0.0.0.0:{PORT}")
    print("="*80)
    
    app.run(
        host='0.0.0.0',
        port=PORT,
        debug=False
    )