"""Merge logic tests on small hand-made tables (test fixtures, not real businesses)."""
from importlib import resources

import duckdb
import pytest

from leadveed_pipeline import merge


def sql(name):
    return resources.files("leadveed_pipeline").joinpath("sql", name).read_text()


@pytest.fixture
def con():
    c = merge.connect(memory_limit="1GB")
    c.execute("""
      CREATE TABLE ov AS SELECT * FROM (VALUES
        ('ov1', 'Acme Dental Clinic', NULL, 'dentist', 'health_care', ['health_care','dentist'], '1 Main St', 'Testville', NULL, '11111', 'PK',
          31.5040, 74.3040, ['+92 300 1234567'], ['https://acmedental.example'], [], [], 0.9, NULL, ['meta'], NULL::TIMESTAMP),
        ('ov2', 'Acme Dental Clinic', NULL, 'dentist', 'health_care', ['health_care','dentist'], NULL, 'Testville', NULL, NULL, 'PK',
          31.5041, 74.3041, ['03001234567'], [], [], [], 0.6, NULL, ['meta'], NULL),
        ('ov3', 'Burger Spot', 'Burger Spot', 'fast_food_restaurant', 'food_and_drink', ['food_and_drink','fast_food_restaurant'], NULL, 'Testville', NULL, NULL, 'PK',
          31.6000, 74.4000, [], ['https://facebook.com/burgerspot'], [], [], 0.5, NULL, ['meta'], NULL),
        ('ov4', 'Lonely Tailor', NULL, 'tailor', 'services_and_business', ['services_and_business','tailor'], NULL, 'دبي', NULL, NULL, 'PK',
          31.5050, 74.3050, [], [], [], [], 0.4, NULL, ['meta'], NULL)
      ) t(src_id, name, brand, category, category_group, categories, street, city, region, postcode, country, lat, lon,
          phones, websites, emails, socials, confidence, operating_status, datasets, source_updated)
    """)
    c.execute(merge.ATP_EMPTY)
    c.execute("""
      INSERT INTO atp_raw VALUES
        ('r1', 'burger_spot_pk', 'Burger Spot Gulberg', 'Burger Spot', 'Q1', 'fast_food', 'amenity', '5 Food Rd',
          'Testville', NULL, '22222', 'PK', 31.6003, 74.4002, ['+92-42-1112223'], ['https://burgerspot.example/gulberg'],
          ['hello@burgerspot.example'], [], 'Mo-Su 12:00-23:00'),
        ('r2', 'burger_spot_pk', 'Burger Spot', 'Burger Spot', 'Q1', 'fast_food', 'amenity', '9 Far Rd',
          'Othertown', NULL, NULL, 'PK', 32.0000, 74.9000, [], ['https://burgerspot.example/far'], [], [], NULL)
    """)
    c.execute(sql("merge.sql"))
    return c


def test_overture_duplicates_collapse(con):
    names = con.execute("SELECT ov_id FROM leads WHERE name = 'Acme Dental Clinic'").fetchall()
    assert names == [("ov1",)]


def test_atp_matches_nearby_overture_by_name(con):
    row = con.execute("""SELECT ov_id, atp_id, street, opening_hours, source_count, emails
                         FROM leads WHERE ov_id = 'ov3'""").fetchone()
    assert row[1] == "atp:burger_spot_pk:r1"
    assert row[2] == "5 Food Rd"            # first-party street wins
    assert row[3] == "Mo-Su 12:00-23:00"
    assert row[4] == 2
    assert row[5] == ["hello@burgerspot.example"]


def test_far_atp_record_stays_separate(con):
    row = con.execute("SELECT ov_id, category_group, categories FROM leads WHERE atp_id = 'atp:burger_spot_pk:r2'").fetchone()
    assert row == (None, "food_and_drink", ["fast_food"])


def test_social_links_are_not_domains(con):
    assert con.execute("SELECT site_domain('https://facebook.com/x'), site_domain('http://www.acme.co.uk/a')").fetchone() \
        == (None, "acme.co.uk")


def test_phone_key_ignores_format(con):
    assert con.execute("SELECT phone_key('+92 300 1234567'), phone_key('0300-1234567')").fetchone() \
        == ("001234567", "001234567")


def test_city_repair_uses_local_latin_name(con):
    assert con.execute("SELECT city FROM leads WHERE ov_id = 'ov4'").fetchone() == ("Testville",)


def test_scores_reward_corroboration(con):
    merged = con.execute("SELECT quality_score FROM leads WHERE ov_id = 'ov3'").fetchone()[0]
    lonely = con.execute("SELECT quality_score FROM leads WHERE ov_id = 'ov4'").fetchone()[0]
    assert 0 <= lonely < merged <= 100


def test_same_phone_and_street_far_apart_is_one_business():
    c = merge.connect(memory_limit="1GB")
    c.execute("""
      CREATE TABLE ov AS SELECT * FROM (VALUES
        ('a', 'Smile Dental', NULL, 'dentist', 'health_care', ['health_care'], '1 Fake Rd', 'Testville', NULL, NULL, 'PK',
          31.55, 74.39, ['+92 300 0000001'], [], [], [], 0.99, NULL, ['meta'], NULL::TIMESTAMP),
        ('b', 'Smile Dental', NULL, 'dentist', 'health_care', ['health_care'], '1 Fake Rd.', 'Testville', NULL, NULL, 'PK',
          31.55, 74.34, ['03000000001'], [], [], [], 0.9, NULL, ['meta'], NULL),
        ('c', 'Fuel Co', NULL, 'gas_station', 'travel_and_transportation', ['x'], '5 North Rd', 'Testville', NULL, NULL, 'PK',
          31.50, 74.30, ['+92 800 0000055'], [], [], [], 0.9, NULL, ['meta'], NULL),
        ('d', 'Fuel Co', NULL, 'gas_station', 'travel_and_transportation', ['x'], '9 South Rd', 'Testville', NULL, NULL, 'PK',
          31.60, 74.40, ['+92 800 0000055'], [], [], [], 0.9, NULL, ['meta'], NULL)
      ) t(src_id, name, brand, category, category_group, categories, street, city, region, postcode, country, lat, lon,
          phones, websites, emails, socials, confidence, operating_status, datasets, source_updated)
    """)
    c.execute(merge.ATP_EMPTY)
    c.execute(sql("merge.sql"))
    assert sorted(r[0] for r in c.execute("SELECT ov_id FROM leads").fetchall()) == ["a", "c", "d"]
