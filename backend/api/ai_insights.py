"""
AI-Powered Insights Generator
Uses OpenAI to provide natural language analysis of monitoring data
"""
import os
from typing import Dict, List, Optional, Any
from datetime import datetime
import json

try:
    from openai import AsyncOpenAI
    OPENAI_AVAILABLE = True
except ImportError:
    OPENAI_AVAILABLE = False
    print("⚠️  OpenAI package not installed. Install with: pip install openai")


class AIInsights:
    """Generate AI-powered insights from monitoring data"""
    
    def __init__(self):
        self.api_key = os.getenv("OPENAI_API_KEY")
        if OPENAI_AVAILABLE and self.api_key and self.api_key != "your-api-key-here":
            self.client = AsyncOpenAI(api_key=self.api_key)
            self.enabled = True
            print("✅ AI insights enabled with OpenAI API")
        else:
            self.client = None
            self.enabled = False
            if not OPENAI_AVAILABLE:
                print("⚠️  OpenAI package not available. AI insights will use fallback mode.")
            elif not self.api_key or self.api_key == "your-api-key-here":
                print("⚠️  OPENAI_API_KEY not set or using placeholder. AI insights will use fallback mode.")
                print("   💡 Set OPENAI_API_KEY in .env file to enable AI-powered insights")
    
    async def generate_executive_summary(
        self,
        discrepancies: List[Dict],
        cauldrons: List[Dict],
        recent_alerts: List[Dict],
        time_range: str = "24 hours"
    ) -> Dict[str, Any]:
        """
        Generate executive summary of current system status
        
        Args:
            discrepancies: List of discrepancy records
            cauldrons: List of cauldron statuses
            recent_alerts: List of recent alerts
            time_range: Time range for analysis
        
        Returns:
            Dict with summary, findings, recommendations, and risk_level
        """
        if not self.enabled:
            return self._get_fallback_summary(discrepancies, cauldrons, recent_alerts)
        
        # Prepare data summary for AI
        critical_count = sum(1 for d in discrepancies if d.get('severity') == 'critical')
        warning_count = sum(1 for d in discrepancies if d.get('severity') == 'warning')
        info_count = sum(1 for d in discrepancies if d.get('severity') == 'info')
        
        # Group discrepancies by courier/witch
        courier_discrepancies = {}
        for d in discrepancies:
            ticket_id = d.get('ticket_id', '')
            # Extract courier ID from ticket (e.g., "TT_20251108_001" -> courier might be in metadata)
            courier = d.get('courier_id') or 'unknown'
            if courier not in courier_discrepancies:
                courier_discrepancies[courier] = []
            courier_discrepancies[courier].append(d)
        
        # Group by cauldron
        cauldron_discrepancies = {}
        for d in discrepancies:
            cauldron_id = d.get('cauldron_id', 'unknown')
            if cauldron_id not in cauldron_discrepancies:
                cauldron_discrepancies[cauldron_id] = []
            cauldron_discrepancies[cauldron_id].append(d)
        
        # Calculate risk level
        risk_level = "LOW"
        if critical_count > 5:
            risk_level = "CRITICAL"
        elif critical_count > 2:
            risk_level = "HIGH"
        elif warning_count > 10:
            risk_level = "MEDIUM"
        
        prompt = f"""You are an operations analyst for a potion distribution network. Analyze the following monitoring data and provide an executive summary.

**Time Range**: Last {time_range}

**Discrepancies Detected**:
- Critical: {critical_count}
- Warning: {warning_count}
- Info: {info_count}
- Total: {len(discrepancies)}

**Top Cauldrons with Issues**:
{self._format_top_cauldrons(cauldron_discrepancies, top_n=5)}

**Courier Patterns**:
{self._format_courier_patterns(courier_discrepancies, top_n=3)}

**Recent Alerts**: {len(recent_alerts)} active alerts

Provide a concise executive summary (2-3 sentences), 3-5 key findings, and 3-5 actionable recommendations. Focus on patterns, risks, and operational improvements.

Return JSON in this exact format:
{{
  "summary": "Brief 2-3 sentence overview of the situation",
  "key_findings": ["Finding 1", "Finding 2", "Finding 3"],
  "recommendations": ["Recommendation 1", "Recommendation 2", "Recommendation 3"],
  "risk_level": "{risk_level}"
}}
"""
        
        try:
            response = await self.client.chat.completions.create(
                model="gpt-5-nano",
                messages=[
                    {"role": "system", "content": "You are a data analyst providing concise, actionable insights. Always return valid JSON."},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.7,
                max_tokens=800,
                response_format={"type": "json_object"}
            )
            
            result = json.loads(response.choices[0].message.content)
            result["generated_at"] = datetime.now().isoformat()
            return result
            
        except Exception as e:
            print(f"❌ Error generating AI summary: {e}")
            return self._get_fallback_summary(discrepancies, cauldrons, recent_alerts)
    
    async def generate_optimization_plan(
        self,
        current_witches: int,
        cauldrons: List[Dict],
        network: Dict,
        forecast_result: Optional[Dict] = None
    ) -> Dict[str, Any]:
        """
        Generate optimization plan for witch allocation
        
        Args:
            current_witches: Current number of witches in use
            cauldrons: List of cauldron statuses with fill rates
            network: Network topology and travel times
            forecast_result: Optional forecast calculation results
        
        Returns:
            Dict with optimization plan, allocation strategy, and savings
        """
        if not self.enabled:
            return self._get_fallback_optimization(current_witches, cauldrons, forecast_result)
        
        # Extract key metrics
        total_cauldrons = len(cauldrons)
        avg_fill_rate = sum(c.get('fill_rate', 0) for c in cauldrons) / total_cauldrons if total_cauldrons > 0 else 0
        high_risk_cauldrons = [c for c in cauldrons if c.get('level', 0) > 80]
        
        min_witches = forecast_result.get('minimum_witches', current_witches) if forecast_result else current_witches
        
        prompt = f"""You are an operations optimization consultant. Analyze the potion network and provide an optimization plan.

**Current State**:
- Witches currently deployed: {current_witches}
- Minimum witches needed (calculated): {min_witches}
- Total cauldrons: {total_cauldrons}
- Average fill rate: {avg_fill_rate:.2f} L/min
- High-risk cauldrons (>80% full): {len(high_risk_cauldrons)}

**Network Topology**:
- {len(network.get('edges', []))} transport routes
- Average travel time: {self._calculate_avg_travel_time(network):.1f} minutes

Provide an optimization plan that:
1. Explains how to reduce witch count while maintaining coverage
2. Suggests route consolidation strategies
3. Estimates cost savings
4. Provides step-by-step implementation

Return JSON in this exact format:
{{
  "plan": "2-3 sentence overview of optimization strategy",
  "witch_allocation": {{
    "witches_needed": {min_witches},
    "rationale": "Explanation of why this number of witches is optimal"
  }},
  "expected_savings": {{
    "witch_hours_saved": "X hours per week",
    "cost_reduction": "X% labor costs, Y% travel time"
  }},
  "implementation_steps": ["Step 1", "Step 2", "Step 3", "Step 4"]
}}
"""
        
        try:
            response = await self.client.chat.completions.create(
                model="gpt-5-nano",
                messages=[
                    {"role": "system", "content": "You are an operations optimization expert. Provide practical, actionable recommendations. Always return valid JSON."},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.7,
                max_tokens=800,
                response_format={"type": "json_object"}
            )
            
            result = json.loads(response.choices[0].message.content)
            result["generated_at"] = datetime.now().isoformat()
            return result
            
        except Exception as e:
            print(f"❌ Error generating optimization plan: {e}")
            return self._get_fallback_optimization(current_witches, cauldrons, forecast_result)
    
    async def generate_fraud_analysis(
        self,
        discrepancies: List[Dict],
        tickets: List[Dict],
        couriers: List[Dict]
    ) -> Dict[str, Any]:
        """
        Generate fraud risk analysis
        
        Args:
            discrepancies: List of discrepancy records
            tickets: List of transport tickets
            couriers: List of courier/witch information
        
        Returns:
            Dict with suspicious patterns, risk scores, and investigation priorities
        """
        if not self.enabled:
            return self._get_fallback_fraud_analysis(discrepancies, tickets, couriers)
        
        # Analyze patterns
        courier_stats = {}
        for d in discrepancies:
            courier_id = d.get('courier_id') or d.get('ticket_id', '').split('_')[0] if '_' in d.get('ticket_id', '') else 'unknown'
            if courier_id not in courier_stats:
                courier_stats[courier_id] = {
                    'count': 0,
                    'total_discrepancy': 0,
                    'critical_count': 0,
                    'avg_discrepancy_percent': 0
                }
            courier_stats[courier_id]['count'] += 1
            courier_stats[courier_id]['total_discrepancy'] += abs(d.get('discrepancy', 0))
            if d.get('severity') == 'critical':
                courier_stats[courier_id]['critical_count'] += 1
        
        for courier_id, stats in courier_stats.items():
            if stats['count'] > 0:
                stats['avg_discrepancy_percent'] = stats['total_discrepancy'] / stats['count']
        
        # Time pattern analysis
        weekend_discrepancies = sum(1 for d in discrepancies if self._is_weekend(d.get('date', '')))
        weekday_discrepancies = len(discrepancies) - weekend_discrepancies
        
        prompt = f"""You are a fraud detection analyst. Analyze transport ticket discrepancies for suspicious patterns.

**Discrepancy Statistics**:
- Total discrepancies: {len(discrepancies)}
- Critical: {sum(1 for d in discrepancies if d.get('severity') == 'critical')}
- Warning: {sum(1 for d in discrepancies if d.get('severity') == 'warning')}

**Courier Performance**:
{self._format_courier_risk_stats(courier_stats)}

**Time Patterns**:
- Weekend discrepancies: {weekend_discrepancies}
- Weekday discrepancies: {weekday_discrepancies}
- Weekend rate: {(weekend_discrepancies / len(discrepancies) * 100) if discrepancies else 0:.1f}%

Identify suspicious patterns, calculate risk scores (0-100) for each courier, and prioritize investigations.

Return JSON in this exact format:
{{
  "suspicious_patterns": ["Pattern 1", "Pattern 2", "Pattern 3"],
  "courier_risk_scores": {{
    "courier_id_1": {{"score": 85, "reason": "Consistent overcollection pattern"}},
    "courier_id_2": {{"score": 15, "reason": "Minor occasional discrepancies"}}
  }},
  "investigation_priorities": [
    {{
      "priority": 1,
      "action": "Specific action to take",
      "reason": "Why this is a priority"
    }}
  ]
}}
"""
        
        try:
            response = await self.client.chat.completions.create(
                model="gpt-5-nano",
                messages=[
                    {"role": "system", "content": "You are a fraud detection expert. Identify suspicious patterns and prioritize investigations. Always return valid JSON."},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.7,
                max_tokens=1000,
                response_format={"type": "json_object"}
            )
            
            result = json.loads(response.choices[0].message.content)
            result["generated_at"] = datetime.now().isoformat()
            return result
            
        except Exception as e:
            print(f"❌ Error generating fraud analysis: {e}")
            return self._get_fallback_fraud_analysis(discrepancies, tickets, couriers)
    
    # Helper methods
    def _format_top_cauldrons(self, cauldron_discrepancies: Dict, top_n: int = 5) -> str:
        """Format top cauldrons with issues for prompt"""
        sorted_cauldrons = sorted(
            cauldron_discrepancies.items(),
            key=lambda x: len(x[1]),
            reverse=True
        )[:top_n]
        
        lines = []
        for cauldron_id, discrepancies in sorted_cauldrons:
            critical = sum(1 for d in discrepancies if d.get('severity') == 'critical')
            lines.append(f"- Cauldron {cauldron_id}: {len(discrepancies)} discrepancies ({critical} critical)")
        
        return "\n".join(lines) if lines else "None"
    
    def _format_courier_patterns(self, courier_discrepancies: Dict, top_n: int = 3) -> str:
        """Format courier patterns for prompt"""
        sorted_couriers = sorted(
            courier_discrepancies.items(),
            key=lambda x: len(x[1]),
            reverse=True
        )[:top_n]
        
        lines = []
        for courier_id, discrepancies in sorted_couriers:
            avg_discrepancy = sum(abs(d.get('discrepancy', 0)) for d in discrepancies) / len(discrepancies) if discrepancies else 0
            lines.append(f"- {courier_id}: {len(discrepancies)} discrepancies, avg {avg_discrepancy:.1f}L difference")
        
        return "\n".join(lines) if lines else "None"
    
    def _format_courier_risk_stats(self, courier_stats: Dict) -> str:
        """Format courier risk statistics for prompt"""
        lines = []
        for courier_id, stats in sorted(courier_stats.items(), key=lambda x: x[1]['count'], reverse=True):
            lines.append(
                f"- {courier_id}: {stats['count']} discrepancies, "
                f"{stats['critical_count']} critical, "
                f"avg {stats['avg_discrepancy_percent']:.1f}% difference"
            )
        return "\n".join(lines) if lines else "None"
    
    def _calculate_avg_travel_time(self, network: Dict) -> float:
        """Calculate average travel time from network edges"""
        edges = network.get('edges', [])
        if not edges:
            return 30.0  # Default
        
        total_time = 0
        count = 0
        for edge in edges:
            cost = edge.get('cost', edge.get('travel_time_minutes', 30))
            if isinstance(cost, str) and ':' in cost:
                # Parse HH:MM:SS format
                parts = cost.split(':')
                minutes = int(parts[0]) * 60 + int(parts[1]) + int(parts[2]) / 60
                total_time += minutes
            elif isinstance(cost, (int, float)):
                total_time += cost
            count += 1
        
        return total_time / count if count > 0 else 30.0
    
    def _is_weekend(self, date_str: str) -> bool:
        """Check if date is weekend"""
        try:
            date = datetime.strptime(date_str.split('T')[0], "%Y-%m-%d")
            return date.weekday() >= 5  # Saturday = 5, Sunday = 6
        except:
            return False
    
    # Fallback methods (when AI is unavailable)
    def _get_fallback_summary(self, discrepancies: List[Dict], cauldrons: List[Dict], alerts: List[Dict]) -> Dict:
        """Fallback summary when AI is unavailable"""
        critical = sum(1 for d in discrepancies if d.get('severity') == 'critical')
        risk_level = "HIGH" if critical > 5 else "MEDIUM" if critical > 2 else "LOW"
        
        return {
            "summary": f"System monitoring detected {len(discrepancies)} discrepancies in the last 24 hours, including {critical} critical issues requiring immediate attention.",
            "key_findings": [
                f"{critical} critical discrepancies detected",
                f"{len(alerts)} active alerts in the system",
                f"Monitoring {len(cauldrons)} cauldrons"
            ],
            "recommendations": [
                "Review critical discrepancies immediately",
                "Investigate patterns in high-discrepancy cauldrons",
                "Consider additional monitoring for high-risk areas"
            ],
            "risk_level": risk_level,
            "generated_at": datetime.now().isoformat(),
            "note": "AI insights unavailable - using fallback analysis"
        }
    
    def _get_fallback_optimization(self, current_witches: int, cauldrons: List[Dict], forecast: Optional[Dict]) -> Dict:
        """Fallback optimization plan"""
        min_witches = forecast.get('minimum_witches', current_witches) if forecast else current_witches
        
        # Calculate savings properly (handle both increase and decrease cases)
        witch_diff = current_witches - min_witches
        if witch_diff > 0:
            # Can reduce witches
            hours_saved = f"{witch_diff * 8} hours per day"
            cost_reduction = f"{((witch_diff / current_witches) * 100):.0f}% labor costs"
            plan_text = f"Current operations use {current_witches} witches. Analysis suggests {min_witches} witches could maintain coverage with optimized routing, reducing costs."
        elif witch_diff < 0:
            # Need more witches
            hours_saved = f"Additional {abs(witch_diff) * 8} hours needed per day"
            cost_reduction = f"{(abs(witch_diff) / current_witches * 100):.0f}% increase in labor costs"
            plan_text = f"Current operations use {current_witches} witches. Analysis indicates {min_witches} witches are needed to prevent overflow, requiring additional resources."
        else:
            # Same number
            hours_saved = "0 hours per day"
            cost_reduction = "0% change"
            plan_text = f"Current operations use {current_witches} witches, which matches the calculated minimum requirement."
        
        return {
            "plan": plan_text,
            "witch_allocation": {
                "witches_needed": min_witches,
                "rationale": "Based on calculated minimum witches required to prevent overflow"
            },
            "expected_savings": {
                "witch_hours_saved": hours_saved,
                "cost_reduction": cost_reduction
            },
            "implementation_steps": [
                "Review forecast calculations",
                "Test with reduced witch count",
                "Monitor for overflow incidents",
                "Adjust routes based on fill rates"
            ],
            "generated_at": datetime.now().isoformat(),
            "note": "AI insights unavailable - using calculated minimum witches"
        }
    
    def _get_fallback_fraud_analysis(self, discrepancies: List[Dict], tickets: List[Dict], couriers: List[Dict]) -> Dict:
        """Fallback fraud analysis"""
        critical = [d for d in discrepancies if d.get('severity') == 'critical']
        
        return {
            "suspicious_patterns": [
                f"{len(critical)} critical discrepancies detected",
                "Review tickets with >50% discrepancy",
                "Monitor couriers with multiple critical issues"
            ],
            "courier_risk_scores": {
                "unknown": {
                    "score": 50,
                    "reason": "Insufficient data for detailed analysis"
                }
            },
            "investigation_priorities": [
                {
                    "priority": 1,
                    "action": "Review all critical discrepancies",
                    "reason": f"{len(critical)} critical issues require immediate attention"
                }
            ],
            "generated_at": datetime.now().isoformat(),
            "note": "AI insights unavailable - using basic pattern detection"
        }
    
    async def explain_component(self, component_name: str, component_data: Dict) -> Dict[str, Any]:
        """
        Generate contextual explanation for a specific UI component
        
        Args:
            component_name: Name of the component (e.g., "Potion Network Graph", "Discrepancies Table")
            component_data: Relevant data from the component
        
        Returns:
            Dict with main_idea, key_points, how_to_read, what_to_look_for
        """
        if not self.enabled:
            return self._get_fallback_explanation(component_name, component_data)
        
        # Prepare context for AI
        data_summary = self._summarize_component_data(component_data)
        
        prompt = f"""You are a user interface guide. Explain what this component shows and how to interpret it, using REAL EXAMPLES from the actual data provided.

**Component**: {component_name}

**Component Data**:
{data_summary}

Provide a clear, concise explanation that helps users understand:
1. What this component is showing (main idea)
2. Key points about the data
3. REAL EXAMPLES from the actual data provided - show specific values, names, or patterns from the data
4. How to read/interpret the visual elements
5. What to look for (important patterns, warnings, etc.)

IMPORTANT: Include 2-3 concrete examples from the actual data. Reference specific cauldron names, values, percentages, or other real data points when available.

Return JSON in this exact format:
{{
  "main_idea": "1-2 sentence explanation of what this component displays",
  "key_points": ["Point 1", "Point 2", "Point 3"],
  "examples": [
    {{
      "title": "Example 1: [Specific case from data]",
      "description": "Detailed explanation using actual data values",
      "data": "Optional: formatted data snippet or value"
    }},
    {{
      "title": "Example 2: [Another specific case]",
      "description": "Another detailed explanation with real data",
      "data": "Optional: formatted data snippet"
    }}
  ],
  "how_to_read": "Explanation of how to interpret the visual elements, colors, labels, etc.",
  "what_to_look_for": "What patterns, values, or changes users should pay attention to"
}}
"""
        
        try:
            response = await self.client.chat.completions.create(
                model="gpt-5-nano",
                messages=[
                    {"role": "system", "content": "You are a helpful UI guide. Explain components clearly and concisely. Always return valid JSON."},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.7,
                max_tokens=600,
                response_format={"type": "json_object"}
            )
            
            result = json.loads(response.choices[0].message.content)
            result["generated_at"] = datetime.now().isoformat()
            return result
            
        except Exception as e:
            print(f"❌ Error generating component explanation: {e}")
            return self._get_fallback_explanation(component_name, component_data)
    
    def _summarize_component_data(self, data: Dict) -> str:
        """Summarize component data for AI prompt"""
        lines = []
        for key, value in data.items():
            if isinstance(value, (int, float, str, bool)):
                lines.append(f"- {key}: {value}")
            elif isinstance(value, list):
                lines.append(f"- {key}: {len(value)} items")
                if len(value) > 0 and isinstance(value[0], dict):
                    # Show sample item
                    sample = value[0]
                    lines.append(f"  Sample: {sample}")
            elif isinstance(value, dict):
                lines.append(f"- {key}: {len(value)} properties")
        return "\n".join(lines) if lines else "No data available"
    
    def _get_fallback_explanation(self, component_name: str, component_data: Dict) -> Dict:
        """Fallback explanation when AI is unavailable"""
        # Component-specific fallbacks with examples
        if "Network" in component_name or "Graph" in component_name:
            sample_nodes = component_data.get('sample_nodes', [])
            nodes_count = component_data.get('nodes', 0)
            links_count = component_data.get('links', 0)
            
            examples = []
            if sample_nodes and len(sample_nodes) > 0:
                for i, node in enumerate(sample_nodes[:3]):
                    status_desc = {
                        'overfill': 'at risk of overflow',
                        'filling': 'approaching capacity',
                        'normal': 'operating normally',
                        'underfill': 'needs attention'
                    }.get(node.get('status', 'normal'), 'operating')
                    
                    examples.append({
                        "title": f"Example: {node.get('name', 'Cauldron')}",
                        "description": f"{node.get('name', 'This cauldron')} is currently at {node.get('fillPercent', 0)}% capacity and is {status_desc}. This is shown as a {'red' if node.get('fillPercent', 0) > 95 else 'blue' if node.get('fillPercent', 0) > 80 else 'green'} circle on the graph.",
                        "data": f"Name: {node.get('name')}, Fill: {node.get('fillPercent')}%, Status: {node.get('status')}"
                    })
            
            return {
                "main_idea": f"This network graph visualizes your potion distribution network with {nodes_count} cauldrons and {links_count} transport routes, showing cauldrons (colored circles) connected to the market (yellow circle).",
                "key_points": [
                    "Each circle represents a cauldron with its current fill percentage",
                    "Colors indicate status: green (normal 20-80%), blue (filling 80-95%), red (overfill >95%)",
                    "Lines show transport routes between cauldrons and the market",
                    "Click on nodes to see detailed information"
                ],
                "examples": examples if examples else [
                    {
                        "title": "Understanding Node Colors",
                        "description": "Green nodes (20-80% full) are operating normally. Blue nodes (80-95%) are filling and may need service soon. Red nodes (>95%) are at risk of overflow and require immediate attention.",
                        "data": "Color coding: Green = Normal, Blue = Filling, Red = Overfill"
                    }
                ],
                "how_to_read": "The size and color of each cauldron node shows its fill level. Green means normal (20-80%), blue means filling (80-95%), and red means overfill (>95%). The market is the central yellow node where all potion is collected.",
                "what_to_look_for": "Watch for red cauldrons (overfill risk), cauldrons with very low percentages (underfill), and check that all cauldrons are connected to the market.",
                "generated_at": datetime.now().isoformat()
            }
        elif "Discrepancies" in component_name or "Discrepancy" in component_name:
            total = component_data.get('total_discrepancies', component_data.get('discrepancies', []))
            if isinstance(total, list):
                total = len(total)
            
            critical = component_data.get('critical', 0)
            warning = component_data.get('warning', 0)
            info = component_data.get('info', 0)
            sample_discrepancies = component_data.get('sample_discrepancies', [])
            
            examples = []
            if sample_discrepancies and len(sample_discrepancies) > 0:
                for i, disc in enumerate(sample_discrepancies[:3]):
                    severity = disc.get('severity', 'info')
                    cauldron_id = disc.get('cauldron_id', 'Unknown')
                    percent = disc.get('discrepancy_percent', 0)
                    
                    examples.append({
                        "title": f"Example: {severity.upper()} Discrepancy in Cauldron {cauldron_id}",
                        "description": f"Cauldron {cauldron_id} has a {severity} discrepancy with {abs(percent):.1f}% difference between the ticket and actual drain. This {'requires immediate investigation' if severity == 'critical' else 'should be reviewed' if severity == 'warning' else 'is within normal variance'}.",
                        "data": f"Cauldron: {cauldron_id}, Severity: {severity}, Difference: {percent:.1f}%"
                    })
            
            if not examples:
                examples = [
                    {
                        "title": f"Current Status: {critical} Critical, {warning} Warning, {info} Info",
                        "description": f"Out of {total} total discrepancies, {critical} are critical (requiring immediate action), {warning} are warnings (should be reviewed), and {info} are informational (within normal variance).",
                        "data": f"Total: {total}, Critical: {critical}, Warning: {warning}, Info: {info}"
                    }
                ]
            
            return {
                "main_idea": f"This table shows {total} discrepancies between transport tickets and actual drain events, helping identify collection errors or fraud.",
                "key_points": [
                    "Each row represents a mismatch between what was collected (ticket) and what actually drained",
                    "Severity levels: Critical (>50% difference), Warning (25-50%), Info (<25%)",
                    "Positive difference means more was collected than drained (overcollection)",
                    "Negative difference means less was collected than drained (undercollection)"
                ],
                "examples": examples,
                "how_to_read": "Review the 'Difference' and '% Off' columns to see how much the ticket volume differs from actual drain volume. Critical discrepancies require immediate investigation.",
                "what_to_look_for": "Look for patterns: couriers with multiple critical discrepancies, cauldrons with consistent issues, or discrepancies clustering on specific dates.",
                "generated_at": datetime.now().isoformat()
            }
        elif "Forecast" in component_name or "Timeline" in component_name:
            snapshots = component_data.get('snapshots', 0)
            cauldrons = component_data.get('cauldrons', 0)
            time_range = component_data.get('time_range', '24 hours')
            is_live = component_data.get('is_live', False)
            
            examples = [
                {
                    "title": f"Timeline Overview: {snapshots} snapshots, {cauldrons} cauldrons",
                    "description": f"This timeline shows {snapshots} data points over the last {time_range}, tracking {cauldrons} cauldrons. Each row represents a cauldron, and each column represents a time point. {'Live updates are enabled' if is_live else 'Live updates are paused'}.",
                    "data": f"Snapshots: {snapshots}, Cauldrons: {cauldrons}, Range: {time_range}, Live: {is_live}"
                },
                {
                    "title": "Reading the Heatmap Colors",
                    "description": "Darker colors (red/orange) indicate higher fill levels (80-100%), while lighter colors (green/blue) indicate lower levels (0-50%). White or very light colors may indicate empty or recently drained cauldrons.",
                    "data": "Color scale: Dark = High fill, Light = Low fill"
                }
            ]
            
            return {
                "main_idea": f"This component shows predicted future states and historical trends of your potion network over the last {time_range}.",
                "key_points": [
                    f"Historical data shows past cauldron levels over {snapshots} time points",
                    "Predictions estimate future overflow risks based on fill rates",
                    "Colors and patterns indicate trends and alerts",
                    f"{'Live updates are active' if is_live else 'Live updates are paused'}"
                ],
                "examples": examples,
                "how_to_read": "Time flows from left to right. Each cell represents a cauldron's level at a specific time. Darker colors typically indicate higher fill levels. Use the play/pause controls to animate through time.",
                "what_to_look_for": "Watch for upward trends that might lead to overflow, sudden drops that indicate drains, and patterns that repeat over time. Clusters of dark cells indicate periods of high fill across multiple cauldrons.",
                "generated_at": datetime.now().isoformat()
            }
        else:
            # Generic fallback
            return {
                "main_idea": f"This {component_name} displays important monitoring data for your potion network.",
                "key_points": [
                    "Data is updated in real-time",
                    "Colors and labels indicate status levels",
                    "Click elements for more details"
                ],
                "examples": [
                    {
                        "title": "Understanding the Data",
                        "description": "This component shows real-time information about your potion network. Values update automatically as new data arrives.",
                        "data": "Component: " + component_name
                    }
                ],
                "how_to_read": "Review the visual elements and their labels to understand the current state of your network.",
                "what_to_look_for": "Watch for unusual patterns or values that deviate from normal operations.",
                "generated_at": datetime.now().isoformat()
            }

