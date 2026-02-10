use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct LogisticsEdge {
    pub from_instance_id: String,
    pub from_port_id: String,
    pub to_instance_id: String,
    pub to_port_id: String,
    pub item_id: String,
    pub throughput: f32, // Items per second
}
